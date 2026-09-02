import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Insight } from "@tokenlens/shared";

const dataMocks = vi.hoisted(() => ({
  benchmarkDetail: vi.fn(),
  repositoryBenchmarks: vi.fn(),
}));

vi.mock("./data", () => dataMocks);
vi.mock("./auth", () => ({ requireRepository: vi.fn(async () => ({ workspaceId: "workspace-1" })) }));
vi.mock("@tokenlens/database/analytics", () => ({
  matchedModelComparisons: () => [],
  repositoryFileHotspots: async () => [],
  repositoryPromptFacts: async () => [],
  repositoryInsightStates: async () => ({}),
  repositorySnapshotDeltas: async () => [],
  repositoryToolHealth: async () => [],
}));

import { repositoryInsightBundle, sortInsights } from "./insights";

const benchmarkPoints = Array.from({ length: 6 }, (_, index) => ({
  id: `run-${index}`,
  startedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  provisional: false,
  contextTokens: index === 5 ? 18_000 : 10_000,
  outputTokens: 100,
  costUsd: null,
  responseDurationMs: 1_000,
  apiCalls: 1,
  toolCalls: index === 5 ? 8 : 2,
  failedTools: 0,
  filesRead: 3,
  filesEdited: 1,
  repeatedReads: 0,
  timeToFirstEditMs: 100,
  headSha: null,
}));

describe("repository benchmark insights", () => {
  beforeEach(() => {
    dataMocks.repositoryBenchmarks.mockResolvedValue([
      { id: "benchmark-1", provider: "codex", model: "gpt-5" },
    ]);
    dataMocks.benchmarkDetail.mockResolvedValue({
      benchmark: {
        id: "benchmark-1",
        name: "Repository navigation",
        repository_id: "repo-1",
        provider: "codex",
        model: "gpt-5",
      },
      points: benchmarkPoints,
    });
  });

  it("surfaces matching benchmark regressions in the repository insight bundle", async () => {
    const bundle = await repositoryInsightBundle("repo-1", { provider: "codex", model: "gpt-5" });

    expect(bundle.insights[0]).toMatchObject({
      rule: "benchmark-context-regression",
      severity: "warning",
      title: "Repository navigation benchmark has regressed",
      scope: { repositoryId: "repo-1", benchmarkId: "benchmark-1" },
    });
  });

  it("prioritises benchmark regressions among warning insights", async () => {
    const benchmark = (await repositoryInsightBundle("repo-1")).insights[0];
    const otherWarning: Insight = {
      ...benchmark,
      id: "other-warning",
      rule: "other-warning",
      title: "Another warning",
    };

    expect(sortInsights([otherWarning, benchmark]).map((insight) => insight.rule))
      .toEqual(["benchmark-context-regression", "other-warning"]);
  });
});
