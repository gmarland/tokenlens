import type {
  BenchmarkFact,
  FileHotspot,
  Insight,
  InsightConfidence,
  MatchedModelComparison,
  PromptFact,
  SnapshotDelta,
  ToolHealth,
} from "@tokenlens/shared";
import { median, spearman } from "./statistics";
import {
  actionHref,
  architectureExample,
  benchmarkRegressionExample,
  cacheExample,
  hotspotExample,
  instructionChangeExample,
  instructionEffectivenessExample,
  modelComparisonExample,
  moduleBreadthExample,
  onboardingExample,
  promptComparisonExample,
  repeatedReadsExample,
  structuralEfficiencyExample,
  structuralGrowthExample,
  timeToEditExample,
  toolFailureExample,
} from "./action-examples";

type Scope = Insight["scope"];

const now = () => new Date().toISOString();
const pct = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
const change = (value: number, baseline: number) => baseline > 0 ? ((value - baseline) / baseline) * 100 : null;
const confidence = (n: number, coverage = 1): InsightConfidence =>
  n >= 50 && coverage >= .8 ? "high" : n >= 20 && coverage >= .7 ? "medium" : "low";
const insightId = (rule: string, scope: Scope, suffix = "") =>
  [rule, scope.repositoryId, scope.benchmarkId, scope.promptId, scope.provider, scope.model, scope.branch, suffix]
    .filter(Boolean).join(":").replace(/[^a-zA-Z0-9:._-]/g, "-");

function base(
  rule: string,
  scope: Scope,
  input: Omit<Insight, "id" | "rule" | "ruleVersion" | "scope" | "detectedAt">,
  suffix = "",
): Insight {
  return { id: insightId(rule, scope, suffix), rule, ruleVersion: 1, scope, detectedAt: now(), ...input };
}

export function benchmarkRegressionInsight(
  runs: BenchmarkFact[],
  scope: Scope,
): Insight | null {
  const complete = runs.filter((run) => !run.provisional).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  if (complete.length < 6) return null;
  const latest = complete.at(-1)!;
  const baselineRuns = complete.slice(-6, -1);
  const baseline = median(baselineRuns.map((run) => run.contextTokens));
  const contextChange = change(latest.contextTokens, baseline);
  if (contextChange == null || contextChange < 20 || latest.contextTokens - baseline < 5_000) return null;

  type NumericBenchmarkKey = "filesRead" | "repeatedReads" | "toolCalls" | "failedTools" | "responseDurationMs";
  const comparable = (key: NumericBenchmarkKey) => {
    const current = latest[key];
    const values = baselineRuns.map((run) => run[key]).filter((value): value is number => typeof value === "number");
    return typeof current === "number" && values.length ? { current, baseline: median(values) } : null;
  };
  const drivers = [
    ["Files read", comparable("filesRead")],
    ["Repeated reads", comparable("repeatedReads")],
    ["Tool calls", comparable("toolCalls")],
    ["Failed tools", comparable("failedTools")],
    ["Response duration", comparable("responseDurationMs")],
  ] as const;
  const strongest = drivers
    .map(([label, values]) => ({ label, values, delta: values ? change(values.current, values.baseline) : null }))
    .filter((item) => item.delta != null)
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))[0];
  const driverText = strongest && strongest.delta! >= 15
    ? ` The largest accompanying change is ${strongest.label.toLowerCase()} (${pct(strongest.delta!)}).`
    : " No single behavioural metric explains the increase.";

  return base("benchmark-context-regression", scope, {
    severity: "warning",
    confidence: complete.length >= 10 ? "high" : "medium",
    title: "Benchmark context has regressed",
    summary: `The latest complete run processed ${pct(contextChange)} more context than the previous five-run median.${driverText}`,
    evidence: [
      { label: "Latest context", value: latest.contextTokens, baseline, unit: "tokens" },
      { label: "Change", value: contextChange, unit: "percent" },
      ...(strongest?.values ? [{ label: strongest.label, value: strongest.values.current, baseline: strongest.values.baseline, unit: strongest.label === "Response duration" ? "milliseconds" as const : "count" as const }] : []),
    ],
    recommendation: {
      text: "Inspect the changed traversal and repository snapshot, then rerun this benchmark.",
      href: actionHref.benchmark(scope),
      example: benchmarkRegressionExample(scope, strongest?.label ?? null),
    },
    validation: { text: "Resolve when a complete run returns within 10% of the five-run baseline.", benchmarkId: scope.benchmarkId, metric: "contextTokens" },
    caveats: ["This is a matched-prompt regression, but repository state and external service conditions may still differ."],
    sampleSize: complete.length,
    coverage: 1,
    comparisonPeriod: "Latest complete run versus previous five complete runs",
  });
}

export function explorationInsights(facts: PromptFact[], scope: Scope): Insight[] {
  const complete = facts.filter((fact) => !fact.provisional && fact.hasUsage);
  if (complete.length < 20) return [];
  const attributed = complete.filter((fact) => fact.fileAttributionAvailable && fact.filesRead != null && fact.repeatedReads != null);
  const coverage = attributed.length / complete.length;
  if (coverage < .7) return [];
  const recent = attributed.slice(-Math.max(10, Math.floor(attributed.length / 3)));
  const baseline = attributed.slice(0, -recent.length);
  if (baseline.length < 10) return [];
  const ratio = (fact: PromptFact) => (fact.totalReads ?? 0) > 0 ? (fact.repeatedReads ?? 0) / fact.totalReads! : 0;
  const currentRepeat = median(recent.map(ratio));
  const baselineRepeat = median(baseline.map(ratio));
  const currentFirstEdit = median(recent.map((fact) => fact.timeToFirstEditMs).filter((x): x is number => x != null));
  const baselineFirstEdit = median(baseline.map((fact) => fact.timeToFirstEditMs).filter((x): x is number => x != null));
  const currentModules = median(recent.map((fact) => fact.modulesVisited).filter((x): x is number => x != null));
  const baselineModules = median(baseline.map((fact) => fact.modulesVisited).filter((x): x is number => x != null));
  const candidates = [
    { key: "repeated-reads", title: "Repeated exploration is increasing", current: currentRepeat * 100, previous: baselineRepeat * 100, unit: "percent" as const, minimum: 10,
      action: "Document common entry points and module responsibilities, then monitor repeated reads.", example: repeatedReadsExample() },
    { key: "time-to-edit", title: "Agents are taking longer to reach a first edit", current: currentFirstEdit, previous: baselineFirstEdit, unit: "milliseconds" as const, minimum: 30,
      action: "Review setup commands and task guidance for avoidable discovery work.", example: timeToEditExample() },
    { key: "module-breadth", title: "Agent working sets are spreading across more modules", current: currentModules, previous: baselineModules, unit: "count" as const, minimum: 25,
      action: "Clarify module boundaries and the expected entry point for common changes.", example: moduleBreadthExample() },
  ];
  return candidates.flatMap((candidate) => {
    const delta = change(candidate.current, candidate.previous);
    if (delta == null || delta < candidate.minimum) return [];
    return [base(`exploration-${candidate.key}`, scope, {
      severity: delta >= 50 ? "warning" : "opportunity",
      confidence: confidence(attributed.length, coverage),
      title: candidate.title,
      summary: `The recent median is ${pct(delta)} above the earlier repository baseline.`,
      evidence: [
        { label: "Recent median", value: candidate.current, baseline: candidate.previous, unit: candidate.unit },
        { label: "Attributed prompts", value: attributed.length, unit: "count" },
      ],
      recommendation: { text: candidate.action, href: actionHref.repository(scope, "hotspots"), example: candidate.example },
      validation: { text: "Compare the next ten complete prompts with the current recent median.", metric: candidate.key },
      caveats: ["Task mix can change exploration behaviour; validate with a saved prompt benchmark where possible."],
      sampleSize: attributed.length,
      coverage,
      comparisonPeriod: "Most recent third versus earlier complete prompts",
    })];
  });
}

export function cacheInsight(facts: PromptFact[], scope: Scope): Insight | null {
  const eligible = facts.filter((fact) => !fact.provisional && fact.hasUsage && fact.cacheMetricsAvailable && fact.contextTokens > 0);
  if (eligible.length < 20) return null;
  const recent = eligible.slice(-Math.max(10, Math.floor(eligible.length / 3)));
  const baseline = eligible.slice(0, -recent.length);
  if (baseline.length < 10) return null;
  const freshShare = (fact: PromptFact) => fact.freshInputTokens / fact.contextTokens;
  const current = median(recent.map(freshShare)) * 100;
  const previous = median(baseline.map(freshShare)) * 100;
  if (current - previous < 15) return null;
  return base("cache-fresh-share", scope, {
    severity: "opportunity",
    confidence: confidence(eligible.length),
    title: "Fresh-input share has increased",
    summary: `Recent prompts use ${current.toFixed(1)}% fresh input, up ${Math.abs(current - previous).toFixed(1)} percentage points.`,
    evidence: [{ label: "Fresh-input share", value: current, baseline: previous, unit: "percent" }],
    recommendation: {
      text: "Check whether stable instructions or repeated context are changing often enough to prevent cache reuse.",
      href: actionHref.repository(scope),
      example: cacheExample(),
    },
    validation: { text: "Monitor fresh-input share for the same provider and model over the next ten prompts.", metric: "freshInputShare" },
    caveats: ["Cache behaviour and pricing differ by provider and model; a lower cache share is not automatically wasteful."],
    sampleSize: eligible.length,
    coverage: eligible.length / facts.filter((fact) => !fact.provisional && fact.hasUsage).length,
    comparisonPeriod: "Most recent third versus earlier complete prompts",
  });
}

export function hotspotInsights(hotspots: FileHotspot[], scope: Scope): Insight[] {
  return hotspots.filter((file) => file.prompts >= 10).slice(0, 5).flatMap((file) => {
    const reasons = [
      file.contextLiftPercent != null && file.contextLiftPercent >= 25 ? `${pct(file.contextLiftPercent)} context lift` : null,
      file.repeatedReads >= Math.max(5, file.prompts / 2) ? `${file.repeatedReads} repeated reads` : null,
      file.loc > 500 ? `${file.loc.toLocaleString()} LOC` : null,
      file.inCycle ? "dependency cycle" : null,
    ].filter(Boolean);
    if (!reasons.length) return [];
    const recommendation = file.generated
      ? "Prevent generated code from entering routine agent traversal where possible."
      : file.inCycle
        ? "Investigate the dependency cycle and document this file’s stable public responsibilities."
        : file.loc > 500
          ? "Consider splitting the file or adding a concise responsibility map near it."
          : "Document why and when agents should visit this file to reduce repeated discovery.";
    return [base("file-hotspot", scope, {
      severity: file.contextLiftPercent != null && file.contextLiftPercent >= 50 ? "warning" : "opportunity",
      confidence: confidence(file.prompts),
      title: `${file.path} is an agent hotspot`,
      summary: `It appears in ${file.prompts} prompts and combines ${reasons.join(", ")}.`,
      evidence: [
        { label: "Prompt coverage", value: file.promptShare * 100, unit: "percent" },
        { label: "Median context", value: file.medianContext, unit: "tokens" },
        { label: "Repeated reads", value: file.repeatedReads, unit: "count" },
      ],
      recommendation: { text: recommendation, href: actionHref.hotspot(scope, file.path), example: hotspotExample(file) },
      validation: { text: "Track this file’s prompt coverage, repeat reads, and matched benchmark context after the change." },
      caveats: ["File access is associated with these prompts; it does not establish that the file caused their token use."],
      sampleSize: file.prompts,
      coverage: file.promptShare,
    }, file.path)];
  });
}

export function toolHealthInsights(tools: ToolHealth[], scope: Scope): Insight[] {
  return tools.flatMap((tool) => {
    const outcomeCoverage = tool.calls ? tool.knownOutcomes / tool.calls : 0;
    if (tool.knownOutcomes < 20 || outcomeCoverage < .7 || tool.failureRate == null || tool.failureRate < .15) return [];
    return [base("tool-failure-rate", scope, {
      severity: tool.failureRate >= .3 ? "warning" : "opportunity",
      confidence: confidence(tool.knownOutcomes, outcomeCoverage),
      title: `${tool.toolName} is failing frequently`,
      summary: `${(tool.failureRate * 100).toFixed(1)}% of calls with known outcomes failed.`,
      evidence: [
        { label: "Failure rate", value: tool.failureRate * 100, unit: "percent" },
        { label: "Known outcomes", value: tool.knownOutcomes, baseline: tool.calls, unit: "count" },
        ...(tool.p95DurationMs == null ? [] : [{ label: "p95 duration", value: tool.p95DurationMs, unit: "milliseconds" as const }]),
      ],
      recommendation: {
        text: "Check the tool command, permissions, environment, and repository instructions for a repeatable failure mode.",
        href: actionHref.tool(scope, tool.toolName),
        example: toolFailureExample(tool.toolName),
      },
      validation: { text: "Resolve after at least 20 subsequent known outcomes remain below a 10% failure rate." },
      caveats: ["Calls without a known outcome are excluded from the failure rate."],
      sampleSize: tool.knownOutcomes,
      coverage: outcomeCoverage,
    }, tool.toolName)];
  });
}

export function architectureInsights(facts: PromptFact[], scope: Scope): Insight[] {
  const eligible = facts.filter((fact) => !fact.provisional && fact.hasUsage && fact.fileAttributionAvailable);
  if (eligible.length < 20) return [];
  const coverage = eligible.length / facts.filter((fact) => !fact.provisional && fact.hasUsage).length;
  if (coverage < .7) return [];
  const dimensions: [string, string, (fact: PromptFact) => number][] = [
    ["module-breadth", "Module breadth", (fact) => fact.modulesVisited ?? 0],
    ["working-set-loc", "Working-set size", (fact) => fact.workingSetLoc ?? 0],
    ["fan-out", "Dependency fan-out", (fact) => fact.meanFanOut ?? 0],
    ["cycle-files", "Cycle exposure", (fact) => fact.cycleFiles ?? 0],
  ];
  return dimensions.flatMap(([key, label, getter]) => {
    const rho = spearman(eligible.map((fact) => fact.contextTokens), eligible.map(getter));
    if (rho == null || rho < .3) return [];
    return [base(`architecture-${key}`, scope, {
      severity: rho >= .5 ? "warning" : "opportunity",
      confidence: confidence(eligible.length, coverage),
      title: `${label} rises with context consumption`,
      summary: `A ${rho >= .5 ? "strong" : "moderate"} positive observed relationship is present (ρ = ${rho.toFixed(2)}).`,
      evidence: [{ label: "Spearman ρ", value: rho }, { label: "Prompts", value: eligible.length, unit: "count" }],
      recommendation: {
        text: `Use a matched benchmark to test whether reducing ${label.toLowerCase()} improves context consumption.`,
        href: actionHref.structure(scope),
        example: architectureExample(key),
      },
      validation: { text: "Validate with before/after runs of the same prompt, provider, and model." },
      caveats: ["This relationship is descriptive and does not establish causation."],
      sampleSize: eligible.length,
      coverage,
    })];
  });
}

export function snapshotChangeInsights(snapshots: SnapshotDelta[], scope: Scope): Insight[] {
  if (snapshots.length < 2) return [];
  const latest = snapshots.at(-1)!;
  const out: Insight[] = [];
  const locChange = latest.locDelta == null ? null : change(latest.totalSourceLoc, latest.totalSourceLoc - latest.locDelta);
  if (locChange != null && locChange >= 20) out.push(base("structural-growth", scope, {
    severity: "opportunity",
    confidence: "high",
    title: "Repository source size changed materially",
    summary: `Source LOC grew ${pct(locChange)} in the latest captured snapshot.`,
    evidence: [{ label: "Source LOC", value: latest.totalSourceLoc, baseline: latest.totalSourceLoc - latest.locDelta!, unit: "count" }],
    recommendation: {
      text: "Review benchmark and exploration trends around this snapshot before attributing any efficiency change to growth.",
      href: actionHref.repository(scope, "benchmarks"),
      example: structuralGrowthExample(),
    },
    validation: { text: "Track matched benchmark context on the new snapshot." },
    caveats: ["Repository growth alone does not imply lower agent efficiency."],
    sampleSize: snapshots.length,
    coverage: 1,
    comparisonPeriod: "Latest snapshot versus previous snapshot",
  }));
  if (latest.instructionBytesDelta != null && latest.instructionBytesDelta !== 0) out.push(base("instruction-change", scope, {
    severity: "info",
    confidence: "medium",
    title: "Agent instruction files changed",
    summary: `Combined AGENTS.md and CLAUDE.md size changed by ${latest.instructionBytesDelta.toLocaleString()} bytes.`,
    evidence: [{ label: "Instruction bytes", value: latest.instructionBytes, baseline: latest.instructionBytes - latest.instructionBytesDelta, unit: "bytes" }],
    recommendation: {
      text: "Use saved prompt benchmarks to check whether traversal and context improve after this instruction change.",
      href: actionHref.repository(scope, "benchmarks"),
      example: instructionChangeExample(),
    },
    validation: { text: "Compare at least five matched runs before and after the snapshot." },
    caveats: ["Current telemetry detects instruction count and byte-size changes, including changes unrelated to guidance quality; same-size edits are not detectable."],
    sampleSize: snapshots.length,
    coverage: 1,
    comparisonPeriod: "Latest snapshot versus previous snapshot",
  }));
  return out;
}

export function instructionEffectivenessInsights(facts: PromptFact[], snapshots: SnapshotDelta[], scope: Scope): Insight[] {
  const changed = [...snapshots].reverse().find((snapshot) => snapshot.instructionChanged === true ||
    (snapshot.instructionChanged == null && snapshot.instructionBytesDelta != null && snapshot.instructionBytesDelta !== 0));
  if (!changed) return [];
  const boundary = Date.parse(changed.capturedAt);
  const groups = new Map<string, PromptFact[]>();
  for (const fact of facts.filter((item) => !item.provisional && item.hasUsage && item.promptFingerprint && item.model)) {
    const key = `${fact.promptFingerprint}\u0000${fact.provider}\u0000${fact.model}`;
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  const comparisons = [...groups.values()].flatMap((group) => {
    const before = group.filter((fact) => Date.parse(fact.startedAt) < boundary);
    const after = group.filter((fact) => Date.parse(fact.startedAt) >= boundary);
    if (before.length < 5 || after.length < 5) return [];
    const beforeMedian = median(before.map((fact) => fact.contextTokens));
    const afterMedian = median(after.map((fact) => fact.contextTokens));
    const delta = change(afterMedian, beforeMedian);
    return delta == null ? [] : [{ beforeMedian, afterMedian, delta, before: before.length, after: after.length }];
  });
  if (!comparisons.length) return [];
  const weightedBefore = median(comparisons.map((item) => item.beforeMedian));
  const weightedAfter = median(comparisons.map((item) => item.afterMedian));
  const delta = change(weightedAfter, weightedBefore);
  if (delta == null) return [];
  const improved = delta <= -10;
  const regressed = delta >= 10;
  return [base("instruction-effectiveness", scope, {
    severity: regressed ? "warning" : improved ? "info" : "opportunity",
    confidence: comparisons.length >= 3 ? "medium" : "low",
    title: improved ? "Matched context improved after an instruction change" : regressed ? "Matched context increased after an instruction change" : "No material matched-context change followed the instruction update",
    summary: `${comparisons.length} exact prompt/model cohort${comparisons.length === 1 ? "" : "s"} show ${pct(delta)} median context after the instruction-size change.`,
    evidence: [
      { label: "Before median", value: weightedBefore, unit: "tokens" },
      { label: "After median", value: weightedAfter, unit: "tokens" },
      { label: "Matched cohorts", value: comparisons.length, unit: "count" },
    ],
    recommendation: {
      text: improved ? "Keep monitoring the matched prompts to confirm the improvement persists." : "Review whether the new guidance is concise and directs agents to concrete entry points.",
      href: actionHref.repository(scope, "benchmarks"),
      example: instructionEffectivenessExample(improved ? "improved" : regressed ? "regressed" : "unchanged"),
    },
    validation: { text: "Collect at least five additional complete runs for each matched prompt cohort." },
    caveats: ["The aggregate fingerprint detects instruction content changes but cannot identify which wording changed; other repository changes at the same snapshot may explain the difference."],
    sampleSize: comparisons.reduce((sum, item) => sum + item.before + item.after, 0),
    coverage: 1,
    comparisonPeriod: `Before and after ${changed.capturedAt}`,
  })];
}

export function structuralEfficiencyInsights(facts: PromptFact[], snapshots: SnapshotDelta[], scope: Scope): Insight[] {
  const latest = snapshots.at(-1);
  if (!latest || latest.locDelta == null || latest.locDelta <= 0) return [];
  const boundary = Date.parse(latest.capturedAt);
  const before = facts.filter((fact) => !fact.provisional && fact.hasUsage && Date.parse(fact.startedAt) < boundary);
  const after = facts.filter((fact) => !fact.provisional && fact.hasUsage && Date.parse(fact.startedAt) >= boundary);
  if (before.length < 10 || after.length < 10) return [];
  const previousLoc = latest.totalSourceLoc - latest.locDelta;
  const locGrowth = previousLoc > 0 ? (latest.locDelta / previousLoc) * 100 : 0;
  const contextBefore = median(before.map((fact) => fact.contextTokens));
  const contextAfter = median(after.map((fact) => fact.contextTokens));
  const contextGrowth = change(contextAfter, contextBefore);
  if (locGrowth < 10 || contextGrowth == null || contextGrowth < 20) return [];
  return [base("structural-efficiency-regression", scope, {
    severity: "warning",
    confidence: confidence(Math.min(before.length, after.length)),
    title: "Context growth is outpacing repository growth",
    summary: `Median context rose ${pct(contextGrowth)} around a ${pct(locGrowth)} source-LOC increase.`,
    evidence: [
      { label: "Median context", value: contextAfter, baseline: contextBefore, unit: "tokens" },
      { label: "Source LOC", value: latest.totalSourceLoc, baseline: previousLoc, unit: "count" },
    ],
    recommendation: {
      text: "Inspect matched benchmarks and hotspot changes around the latest snapshot before attributing the regression to growth.",
      href: actionHref.repository(scope, "hotspots"),
      example: structuralEfficiencyExample(),
    },
    validation: { text: "Use exact-prompt runs on both snapshots to isolate the repository-state effect." },
    caveats: ["The before/after prompt mix is not matched for task complexity."],
    sampleSize: before.length + after.length,
    coverage: 1,
    comparisonPeriod: `Before and after ${latest.capturedAt}`,
  })];
}

export function onboardingInsight(facts: PromptFact[], scope: Scope): Insight | null {
  const complete = facts.filter((fact) => !fact.provisional && fact.hasUsage && fact.developerId && fact.fileAttributionAvailable);
  const developers = new Map<string, PromptFact[]>();
  for (const fact of complete) developers.set(fact.developerId!, [...(developers.get(fact.developerId!) ?? []), fact]);
  if (developers.size < 5) return null;
  const newcomer: PromptFact[] = [], established: PromptFact[] = [];
  for (const group of developers.values()) {
    group.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    newcomer.push(...group.slice(0, 5));
    established.push(...group.slice(5));
  }
  if (newcomer.length < 20 || established.length < 20) return null;
  const repeatRatio = (fact: PromptFact) => (fact.totalReads ?? 0) > 0 ? (fact.repeatedReads ?? 0) / fact.totalReads! : 0;
  const newcomerRepeat = median(newcomer.map(repeatRatio));
  const establishedRepeat = median(established.map(repeatRatio));
  const delta = change(newcomerRepeat, establishedRepeat);
  if (delta == null || delta < 30) return null;
  return base("onboarding-exploration", scope, {
    severity: "opportunity",
    confidence: developers.size >= 10 ? "medium" : "low",
    title: "Early repository sessions show more repeated exploration",
    summary: `The first five observed prompts per developer have ${pct(delta)} more repeated-read share than later prompts.`,
    evidence: [
      { label: "Early-session repeat share", value: newcomerRepeat * 100, baseline: establishedRepeat * 100, unit: "percent" },
      { label: "Developer cohort", value: developers.size, unit: "count" },
    ],
    recommendation: {
      text: "Improve repository onboarding and entry-point guidance; do not use this aggregate to evaluate individuals.",
      href: actionHref.structure(scope),
      example: onboardingExample(),
    },
    validation: { text: "Compare the privacy-safe aggregate after at least five new developers have been observed." },
    caveats: ["The cohorts are not matched for task complexity.", "No individual developer measurements are exposed."],
    sampleSize: newcomer.length + established.length,
    coverage: complete.length / facts.filter((fact) => !fact.provisional && fact.hasUsage).length,
  });
}

export function modelComparisonInsights(rows: MatchedModelComparison[], scope: Scope): Insight[] {
  const byPrompt = new Map<string, MatchedModelComparison[]>();
  for (const row of rows) {
    const group = byPrompt.get(row.promptFingerprint) ?? [];
    group.push(row);
    byPrompt.set(row.promptFingerprint, group);
  }
  const out: Insight[] = [];
  for (const [fingerprint, group] of byPrompt) {
    const eligible = group.filter((row) => row.runs >= 3);
    if (eligible.length < 2) continue;
    const sorted = [...eligible].sort((a, b) => a.medianContext - b.medianContext);
    const best = sorted[0], current = sorted.at(-1)!;
    const delta = change(current.medianContext, best.medianContext);
    if (delta == null || delta < 20) continue;
    out.push(base("matched-model-candidate", scope, {
      severity: "opportunity",
      confidence: eligible.every((row) => row.runs >= 5) ? "medium" : "low",
      title: "A matched model comparison is available",
      summary: `${best.provider}/${best.model} used ${Math.abs(delta).toFixed(1)}% less median context than ${current.provider}/${current.model} for the same prompt text.`,
      evidence: [
        { label: `${best.model} median`, value: best.medianContext, unit: "tokens" },
        { label: `${current.model} median`, value: current.medianContext, unit: "tokens" },
      ],
      recommendation: {
        text: "Treat the lower-context model as a candidate for a controlled quality evaluation.",
        href: actionHref.comparisons(scope),
        example: modelComparisonExample(`${best.provider}/${best.model}`, `${current.provider}/${current.model}`),
      },
      validation: { text: "Compare response quality outside TokenLens before changing model routing." },
      caveats: ["TokenLens does not collect assistant responses and cannot assess correctness or quality.", "Provider tool behaviour may not be directly comparable."],
      sampleSize: eligible.reduce((sum, row) => sum + row.runs, 0),
      coverage: 1,
    }, fingerprint));
  }
  return out;
}

export function promptComparisonInsight(prompt: PromptFact, cohort: PromptFact[], scope: Scope): Insight | null {
  const eligible = cohort.filter((fact) => !fact.provisional && fact.hasUsage && fact.id !== prompt.id);
  if (!prompt.hasUsage || eligible.length < 10) return null;
  const baseline = median(eligible.map((fact) => fact.contextTokens));
  const delta = change(prompt.contextTokens, baseline);
  if (delta == null || Math.abs(delta) < 20) return null;
  return base("prompt-context-comparison", scope, {
    severity: delta > 0 ? "opportunity" : "info",
    confidence: confidence(eligible.length),
    title: delta > 0 ? "This prompt used more context than its repository cohort" : "This prompt used less context than its repository cohort",
    summary: `Context was ${pct(delta)} relative to complete prompts using the same provider and model.`,
    evidence: [{ label: "Prompt context", value: prompt.contextTokens, baseline, unit: "tokens" }],
    recommendation: {
      text: delta > 0 ? "Review the working set and repeated reads below for likely exploration drivers." : "Consider saving this prompt as a benchmark to preserve the observed behaviour.",
      href: delta > 0 ? actionHref.promptWorkingSet(scope) : actionHref.promptBenchmark(scope),
      example: promptComparisonExample(delta > 0),
    },
    validation: { text: "Use an exact-prompt benchmark before treating the difference as a regression or improvement." },
    caveats: ["The cohort is not matched for task complexity."],
    sampleSize: eligible.length,
    coverage: 1,
  });
}
