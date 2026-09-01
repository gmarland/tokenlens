import { describe, expect, it } from "vitest";
import type { BenchmarkFact, MatchedModelComparison, PromptFact } from "@tokenlens/shared";
import {
  benchmarkRegressionInsight,
  cacheInsight,
  explorationInsights,
  modelComparisonInsights,
  onboardingInsight,
} from "./insights";

const fact = (index: number, overrides: Partial<PromptFact> = {}): PromptFact => ({
  id: `prompt-${index}`, repositoryId: "repo", snapshotId: null, promptFingerprint: `fingerprint-${index}`,
  promptText: `prompt ${index}`, provider: "codex", model: "model-a", branch: "main", developerId: "developer-1",
  startedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(), provisional: false, hasUsage: true,
  cacheMetricsAvailable: true, freshInputTokens: 500, cacheReadTokens: 500, cacheCreationTokens: 0,
  outputTokens: 100, contextTokens: 1_000, costUsd: null, responseDurationMs: 1_000, apiCalls: 1,
  toolCalls: 2, knownToolOutcomes: 2, failedTools: 0, toolDurationMs: 100, toolResultBytes: 200,
  fileAttributionAvailable: true, totalReads: 4, filesRead: 3, repeatedReads: 1, filesEdited: 1,
  modulesVisited: 2, workingSetLoc: 300, largestFileLoc: 200, meanFanOut: 2, cycleFiles: 0,
  timeToFirstEditMs: 500,
  ...overrides,
});

describe("benchmarkRegressionInsight", () => {
  it("requires five complete baseline runs and both relative and absolute regression", () => {
    const runs: BenchmarkFact[] = Array.from({ length: 6 }, (_, index) => ({
      id: String(index), startedAt: new Date(2026, 0, index + 1).toISOString(), provisional: false,
      contextTokens: index === 5 ? 18_000 : 10_000, outputTokens: 100, costUsd: null,
      responseDurationMs: 1_000, apiCalls: 1, toolCalls: index === 5 ? 8 : 2, failedTools: 0,
      filesRead: 3, filesEdited: 1, repeatedReads: 0, timeToFirstEditMs: 100,
    }));
    const insight = benchmarkRegressionInsight(runs, { repositoryId: "repo", benchmarkId: "benchmark" });
    expect(insight?.rule).toBe("benchmark-context-regression");
    expect(insight?.summary).toContain("tool calls");
    expect(insight?.recommendation.example.steps.length).toBeGreaterThan(0);
    expect(benchmarkRegressionInsight(runs.slice(1), { repositoryId: "repo" })).toBeNull();
  });
});

describe("repository insight gates", () => {
  it("suppresses exploration insights when attribution coverage is low", () => {
    const facts = Array.from({ length: 30 }, (_, index) => fact(index, {
      fileAttributionAvailable: index < 10,
      filesRead: index < 10 ? 2 : null,
      repeatedReads: index < 10 ? 1 : null,
    }));
    expect(explorationInsights(facts, { repositoryId: "repo" })).toEqual([]);
  });

  it("detects a provider/model-scoped fresh-input shift", () => {
    const facts = Array.from({ length: 30 }, (_, index) => fact(index, index < 20
      ? { freshInputTokens: 200, cacheReadTokens: 800 }
      : { freshInputTokens: 700, cacheReadTokens: 300 }));
    expect(cacheInsight(facts, { repositoryId: "repo", provider: "codex", model: "model-a" })?.rule)
      .toBe("cache-fresh-share");
  });

  it("does not expose onboarding comparisons for small developer cohorts", () => {
    const facts = Array.from({ length: 50 }, (_, index) => fact(index, { developerId: `developer-${index % 4}` }));
    expect(onboardingInsight(facts, { repositoryId: "repo" })).toBeNull();
  });
});

describe("modelComparisonInsights", () => {
  it("labels lower usage as a quality-evaluation candidate", () => {
    const rows: MatchedModelComparison[] = [
      { promptFingerprint: "same", promptText: "same prompt", provider: "codex", model: "a", runs: 5, medianContext: 10_000, medianDurationMs: 100, medianCostUsd: null, medianFilesRead: 2, failureRate: 0 },
      { promptFingerprint: "same", promptText: "same prompt", provider: "codex", model: "b", runs: 5, medianContext: 15_000, medianDurationMs: 100, medianCostUsd: null, medianFilesRead: 2, failureRate: 0 },
    ];
    const insight = modelComparisonInsights(rows, { repositoryId: "repo" })[0];
    expect(insight.recommendation.text).toContain("quality evaluation");
    expect(insight.recommendation.example.title).toContain("codex/a");
    expect(insight.caveats.join(" ")).toContain("correctness or quality");
  });
});
