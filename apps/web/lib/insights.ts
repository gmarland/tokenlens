import {
  architectureInsights,
  benchmarkRegressionInsight,
  cacheInsight,
  explorationInsights,
  hotspotInsights,
  instructionEffectivenessInsights,
  modelComparisonInsights,
  promptComparisonInsight,
  snapshotChangeInsights,
  structuralEfficiencyInsights,
  toolHealthInsights,
  onboardingInsight,
} from "@tokenlens/analytics";
import {
  matchedModelComparisons,
  repositoryFileHotspots,
  repositoryPromptFacts,
  repositoryInsightStates,
  repositorySnapshotDeltas,
  repositoryToolHealth,
  type AnalyticsFilter,
} from "@tokenlens/database/analytics";
import type { BenchmarkFact, Insight } from "@tokenlens/shared";
import { benchmarkDetail, repositoryBenchmarks } from "./data";
import type { PromptBenchmarkSummary } from "../components/prompt-benchmarks";

const severity = { warning: 0, opportunity: 1, info: 2 } as const;
const sorted = (insights: Insight[]) => [...insights].sort((a, b) =>
  severity[a.severity] - severity[b.severity] || b.confidence.localeCompare(a.confidence) || a.title.localeCompare(b.title));

export function scopedInsightFilter(input: { provider?: string; model?: string; branch?: string; range?: string }): AnalyticsFilter {
  const days = input.range === "7d" ? 7 : input.range === "30d" ? 30 : input.range === "90d" ? 90 : null;
  return {
    provider: input.provider,
    model: input.model,
    branch: input.branch,
    startAt: days == null ? undefined : new Date(Date.now() - days * 86_400_000).toISOString(),
  };
}

export async function repositoryInsightBundle(repositoryId: string, filter: AnalyticsFilter = {}) {
  const facts = await repositoryPromptFacts(repositoryId, filter);
  const [hotspots, tools, snapshots, states] = await Promise.all([
    repositoryFileHotspots(repositoryId, facts),
    repositoryToolHealth(facts),
    repositorySnapshotDeltas(repositoryId),
    repositoryInsightStates(repositoryId),
  ]);
  const scope = { repositoryId, provider: filter.provider, model: filter.model, branch: filter.branch, startAt: filter.startAt };
  const comparisonCandidates = matchedModelComparisons(facts);
  const comparisonVariants = new Map<string, number>();
  for (const comparison of comparisonCandidates) comparisonVariants.set(
    comparison.promptFingerprint,
    (comparisonVariants.get(comparison.promptFingerprint) ?? 0) + 1,
  );
  const comparisons = comparisonCandidates.filter((comparison) => (comparisonVariants.get(comparison.promptFingerprint) ?? 0) >= 2);
  const onboarding = onboardingInsight(facts, scope);
  const insights = sorted([
    ...explorationInsights(facts, scope),
    ...architectureInsights(facts, scope),
    ...hotspotInsights(hotspots, scope),
    ...toolHealthInsights(tools, scope),
    ...snapshotChangeInsights(snapshots, scope),
    ...instructionEffectivenessInsights(facts, snapshots, scope),
    ...structuralEfficiencyInsights(facts, snapshots, scope),
    ...modelComparisonInsights(comparisons, scope),
    ...(onboarding ? [onboarding] : []),
    ...(cacheInsight(facts, scope) ? [cacheInsight(facts, scope)!] : []),
  ]).map((insight) => ({ ...insight, state: states[insight.id] ?? "new" as const }));
  return { insights, facts, hotspots, tools, snapshots, comparisons };
}

export async function benchmarkInsight(benchmarkId: string) {
  const detail = await benchmarkDetail(benchmarkId);
  if (!detail) return null;
  const runs: BenchmarkFact[] = detail.points.map((point: any) => ({
    id: point.id,
    startedAt: point.startedAt,
    provisional: point.provisional,
    contextTokens: point.contextTokens,
    outputTokens: point.outputTokens,
    costUsd: point.costUsd,
    responseDurationMs: point.responseDurationMs,
    apiCalls: point.apiCalls,
    toolCalls: point.toolCalls,
    failedTools: point.failedTools,
    filesRead: point.filesRead,
    filesEdited: point.filesEdited,
    repeatedReads: point.repeatedReads,
    timeToFirstEditMs: point.timeToFirstEditMs,
    headSha: point.headSha,
  }));
  const insight = benchmarkRegressionInsight(runs, {
    repositoryId: detail.benchmark.repository_id,
    benchmarkId,
    provider: detail.benchmark.provider,
    model: detail.benchmark.model,
  });
  const states = await repositoryInsightStates(detail.benchmark.repository_id);
  return { detail, insights: insight ? [{ ...insight, state: states[insight.id] ?? "new" as const }] : [] };
}

export async function repositoryBenchmarkSummaries(repositoryId: string): Promise<PromptBenchmarkSummary[]> {
  const benchmarks = await repositoryBenchmarks(repositoryId);
  const regressions = new Map(await Promise.all(benchmarks.map(async (benchmark: any) => {
    const result = await benchmarkInsight(String(benchmark.id));
    return [String(benchmark.id), Boolean(result?.insights.length)] as const;
  })));

  return benchmarks.map((benchmark: any) => ({
    id: String(benchmark.id),
    name: String(benchmark.name),
    provider: String(benchmark.provider),
    model: String(benchmark.model),
    runs: Number(benchmark.runs ?? 0),
    lastSeenAt: benchmark.last_seen_at ? new Date(benchmark.last_seen_at).toISOString() : null,
    medianContext: benchmark.median_context == null ? null : Number(benchmark.median_context),
    regression: regressions.get(String(benchmark.id)) ?? false,
  }));
}

export async function promptInsight(promptId: string, repositoryId: string, provider: string, model: string | null) {
  const facts = await repositoryPromptFacts(repositoryId, { provider, model: model ?? undefined });
  const prompt = facts.find((fact) => fact.id === promptId);
  if (!prompt) return [];
  const insight = promptComparisonInsight(prompt, facts, { repositoryId, promptId, provider, model: model ?? undefined });
  if (!insight) return [];
  const states = await repositoryInsightStates(repositoryId);
  return [{ ...insight, state: states[insight.id] ?? "new" as const }];
}
