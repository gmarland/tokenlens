import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ db: vi.fn() }));

vi.mock("./index", () => ({
  ApiRequest: class ApiRequest {},
  Developer: class Developer {},
  Prompt: class Prompt {},
  RepoSnapshot: class RepoSnapshot {},
  RepoSnapshotFile: class RepoSnapshotFile {},
  Repository: class Repository {},
  ToolEvent: class ToolEvent {},
  db: database.db,
}));

import { promptForEvent } from "./services";

function repository(recent: unknown, exact: unknown) {
  const query = {
    where: vi.fn(),
    andWhere: vi.fn(),
    orderBy: vi.fn(),
    getOne: vi.fn(async () => recent),
  };
  query.where.mockReturnValue(query);
  query.andWhere.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  return {
    query,
    value: {
      createQueryBuilder: vi.fn(() => query),
      findOneBy: vi.fn(async () => exact),
    },
  };
}

const codexEvent = {
  provider: "codex" as const,
  kind: "user_prompt" as const,
  promptId: "session-1",
  sessionId: "session-1",
  sequence: "1",
  timestamp: new Date("2026-08-30T12:00:00.000Z"),
};

describe("Codex prompt attribution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prefers the latest hook prompt over an exact session stub", async () => {
    const recent = { id: "turn-1", hookReceivedAt: new Date() };
    const exactStub = { id: "session-1", hookReceivedAt: null };
    const prompts = repository(recent, exactStub);
    database.db.mockResolvedValue({ getRepository: () => prompts.value });

    await expect(promptForEvent("workspace-1", codexEvent)).resolves.toBe(recent);
    expect(prompts.value.findOneBy).not.toHaveBeenCalled();
    expect(prompts.query.andWhere).toHaveBeenCalledWith(
      "prompt.hook_received_at IS NOT NULL",
    );
  });

  it("falls back to an exact stub when no hook prompt predates the event", async () => {
    const exactStub = { id: "session-1", hookReceivedAt: null };
    const prompts = repository(null, exactStub);
    database.db.mockResolvedValue({ getRepository: () => prompts.value });

    await expect(promptForEvent("workspace-1", codexEvent)).resolves.toBe(exactStub);
    expect(prompts.value.findOneBy).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      provider: "codex",
      externalPromptId: "session-1",
    });
  });

  it("leaves Claude exact-ID attribution unchanged", async () => {
    const exact = { id: "prompt-1" };
    const prompts = repository(null, exact);
    database.db.mockResolvedValue({ getRepository: () => prompts.value });

    await expect(promptForEvent("workspace-1", {
      ...codexEvent,
      provider: "claude",
      promptId: "prompt-1",
    })).resolves.toBe(exact);
    expect(prompts.value.createQueryBuilder).not.toHaveBeenCalled();
  });
});
