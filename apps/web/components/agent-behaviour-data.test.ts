import { describe, expect, it } from "vitest";
import {
  agentBehaviourUserLabel,
  buildUserTrendSeries,
  groupBehaviourPrompts,
  type AgentBehaviourPrompt,
} from "./agent-behaviour-data";

const prompt = (overrides: Partial<AgentBehaviourPrompt>): AgentBehaviourPrompt => ({
  id: "prompt-1",
  date: "31/08/2026",
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

describe("buildUserTrendSeries", () => {
  it("creates a separate, labelled line for each user", () => {
    const prompts = [
      prompt({ id: "1", context: 100, developerId: "developer-1", developerLabel: "one@example.com" }),
      prompt({ id: "2", context: 200, developerId: "developer-2", developerLabel: "two@example.com" }),
      prompt({ id: "3", context: 300, developerId: "developer-1", developerLabel: "one@example.com" }),
    ];
    const users = groupBehaviourPrompts(prompts, "user");

    expect(buildUserTrendSeries(prompts, users, "context")).toEqual([
      { id: "user:developer-1", label: "one@example.com", data: [100, null, 300] },
      { id: "user:developer-2", label: "two@example.com", data: [null, 200, null] },
    ]);
  });
});
