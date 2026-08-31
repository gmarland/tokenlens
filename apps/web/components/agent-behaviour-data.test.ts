import { describe, expect, it } from "vitest";
import {
  agentBehaviourUserLabel,
  behaviourBucketStart,
  buildAggregatedBehaviourTrend,
  filterBehaviourPromptsByRange,
  groupBehaviourPrompts,
  type AgentBehaviourPrompt,
} from "./agent-behaviour-data";

const prompt = (overrides: Partial<AgentBehaviourPrompt>): AgentBehaviourPrompt => ({
  id: "prompt-1",
  startedAt: "2026-08-31T12:00:00.000Z",
  context: 100,
  files: 2,
  branch: "main",
  developerId: "developer-1",
  developerLabel: "dev@example.com",
  ...overrides,
});

describe("groupBehaviourPrompts", () => {
  it("groups branches and sorts the busiest first", () => {
    const groups = groupBehaviourPrompts([
      prompt({ id: "1", branch: "feature" }),
      prompt({ id: "2", branch: "main" }),
      prompt({ id: "3", branch: "main" }),
    ], "branch");

    expect(groups.map((group) => [group.label, group.prompts.length])).toEqual([
      ["main", 2],
      ["feature", 1],
    ]);
  });

  it("keeps developers with the same email separate by stable id", () => {
    const groups = groupBehaviourPrompts([
      prompt({ id: "1", developerId: "developer-1" }),
      prompt({ id: "2", developerId: "developer-2" }),
    ], "user");

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.key)).toEqual(["user:developer-1", "user:developer-2"]);
  });

  it("retains unattributed prompts in explicit fallback buckets", () => {
    const unknownBranch = groupBehaviourPrompts([
      prompt({ branch: null }),
      prompt({ id: "2", branch: "  " }),
    ], "branch");
    const pendingIdentity = groupBehaviourPrompts([
      prompt({ developerId: null, developerLabel: null }),
    ], "user");

    expect(unknownBranch[0]).toMatchObject({ key: "branch:unknown", label: "Unknown branch" });
    expect(unknownBranch[0].prompts).toHaveLength(2);
    expect(pendingIdentity[0]).toMatchObject({ key: "user:pending", label: "Identity pending" });
  });
});

describe("agentBehaviourUserLabel", () => {
  it("uses the display label when it is available", () => {
    expect(agentBehaviourUserLabel(prompt({ developerLabel: "dev@example.com" }))).toBe("dev@example.com");
  });

  it("falls back to a shortened identity and then the pending label", () => {
    expect(agentBehaviourUserLabel(prompt({ developerId: "1234567890", developerLabel: null })))
      .toBe("Identity 12345678");
    expect(agentBehaviourUserLabel(prompt({ developerId: null, developerLabel: null })))
      .toBe("Identity pending");
  });
});

describe("behaviourBucketStart", () => {
  const timestamp = "2026-08-31T17:42:37.123Z";

  it.each([
    ["minute", "2026-08-31T17:42:00.000Z"],
    ["hour", "2026-08-31T17:00:00.000Z"],
    ["day", "2026-08-31T00:00:00.000Z"],
    ["week", "2026-08-31T00:00:00.000Z"],
    ["month", "2026-08-01T00:00:00.000Z"],
  ] as const)("builds the containing UTC %s bucket", (aggregation, expected) => {
    expect(behaviourBucketStart(timestamp, aggregation)).toBe(expected);
  });

  it("starts weekly buckets on Monday", () => {
    expect(behaviourBucketStart("2026-09-06T12:00:00.000Z", "week"))
      .toBe("2026-08-31T00:00:00.000Z");
  });
});

describe("buildAggregatedBehaviourTrend", () => {
  it("creates a separate, labelled line for each user", () => {
    const prompts = [
      prompt({ id: "1", startedAt: "2026-08-31T12:00:00.000Z", context: 100, developerId: "developer-1", developerLabel: "one@example.com" }),
      prompt({ id: "2", startedAt: "2026-08-31T12:01:00.000Z", context: 200, developerId: "developer-2", developerLabel: "two@example.com" }),
      prompt({ id: "3", startedAt: "2026-08-31T12:02:00.000Z", context: 300, developerId: "developer-1", developerLabel: "one@example.com" }),
    ];
    const users = groupBehaviourPrompts(prompts, "user");

    expect(buildAggregatedBehaviourTrend(prompts, users, "context", "minute").series).toEqual([
      { id: "user:developer-1", label: "one@example.com", data: [100, null, 300] },
      { id: "user:developer-2", label: "two@example.com", data: [null, 200, null] },
    ]);
  });

  it("creates a separate, labelled line for each branch", () => {
    const prompts = [
      prompt({ id: "1", startedAt: "2026-08-31T12:00:00.000Z", branch: "main", files: 2 }),
      prompt({ id: "2", startedAt: "2026-08-31T12:01:00.000Z", branch: "feature", files: 4 }),
      prompt({ id: "3", startedAt: "2026-08-31T12:02:00.000Z", branch: "main", files: 6 }),
    ];
    const branches = groupBehaviourPrompts(prompts, "branch");

    expect(buildAggregatedBehaviourTrend(prompts, branches, "files", "minute").series).toEqual([
      { id: "branch:main", label: "main", data: [2, null, 6] },
      { id: "branch:feature", label: "feature", data: [null, 4, null] },
    ]);
  });

  it("keeps separate observations that occur on the same calendar day", () => {
    const prompts = [
      prompt({ id: "1", startedAt: "2026-08-31T09:00:00.000Z", context: 100 }),
      prompt({ id: "2", startedAt: "2026-08-31T17:00:00.000Z", context: 200 }),
    ];
    const users = groupBehaviourPrompts(prompts, "user");

    expect(prompts.map((item) => item.startedAt)).toEqual([
      "2026-08-31T09:00:00.000Z",
      "2026-08-31T17:00:00.000Z",
    ]);
    const trend = buildAggregatedBehaviourTrend(prompts, users, "context", "minute");
    expect(trend.timestamps).toEqual([
      "2026-08-31T09:00:00.000Z",
      "2026-08-31T17:00:00.000Z",
    ]);
    expect(trend.series[0].data).toEqual([100, 200]);
  });

  it("uses the median for multiple prompts in the same bucket", () => {
    const prompts = [
      prompt({ id: "1", startedAt: "2026-08-31T09:00:00.000Z", context: 100 }),
      prompt({ id: "2", startedAt: "2026-08-31T12:00:00.000Z", context: 900 }),
      prompt({ id: "3", startedAt: "2026-08-31T17:00:00.000Z", context: 300 }),
    ];
    const users = groupBehaviourPrompts(prompts, "user");

    expect(buildAggregatedBehaviourTrend(prompts, users, "context", "day")).toEqual({
      timestamps: ["2026-08-31T00:00:00.000Z"],
      series: [{ id: "user:developer-1", label: "dev@example.com", data: [300] }],
    });
  });
});

describe("filterBehaviourPromptsByRange", () => {
  const prompts = [
    prompt({ id: "old", startedAt: "2025-01-01T12:00:00.000Z" }),
    prompt({ id: "month", startedAt: "2026-08-01T12:00:00.000Z" }),
    prompt({ id: "week", startedAt: "2026-08-25T12:00:00.000Z" }),
    prompt({ id: "latest", startedAt: "2026-08-31T12:00:00.000Z" }),
  ];

  it("returns every prompt for all time", () => {
    expect(filterBehaviourPromptsByRange(prompts, "all")).toBe(prompts);
  });

  it("anchors relative ranges to the latest repository prompt", () => {
    expect(filterBehaviourPromptsByRange(prompts, "7d").map((item) => item.id))
      .toEqual(["week", "latest"]);
    expect(filterBehaviourPromptsByRange(prompts, "30d").map((item) => item.id))
      .toEqual(["month", "week", "latest"]);
  });

  it("includes prompts exactly on the range boundary", () => {
    const boundary = prompt({ id: "boundary", startedAt: "2026-08-30T12:00:00.000Z" });
    expect(filterBehaviourPromptsByRange([boundary, prompts[3]], "24h").map((item) => item.id))
      .toEqual(["boundary", "latest"]);
  });

  it("supports inclusive custom calendar dates", () => {
    const customPrompts = [
      prompt({ id: "before", startedAt: "2026-08-24T23:59:59.999Z" }),
      prompt({ id: "start", startedAt: "2026-08-25T00:00:00.000Z" }),
      prompt({ id: "end", startedAt: "2026-08-31T23:59:59.999Z" }),
      prompt({ id: "after", startedAt: "2026-09-01T00:00:00.000Z" }),
    ];

    expect(filterBehaviourPromptsByRange(customPrompts, "custom", {
      start: "2026-08-25",
      end: "2026-08-31",
    }).map((item) => item.id)).toEqual(["start", "end"]);
  });

  it("does not filter custom ranges until dates have been applied", () => {
    expect(filterBehaviourPromptsByRange(prompts, "custom", null)).toBe(prompts);
  });

  it("uses a shared reference timestamp for relative ranges", () => {
    expect(filterBehaviourPromptsByRange(
      prompts,
      "7d",
      null,
      "2026-09-07T12:00:00.000Z",
    ).map((item) => item.id)).toEqual(["latest"]);
  });
});
