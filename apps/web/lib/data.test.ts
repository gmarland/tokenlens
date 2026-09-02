import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, queryMock } = vi.hoisted(() => ({
  dbMock: vi.fn(),
  queryMock: vi.fn(),
}));

vi.mock("@tokenlens/database", () => ({ db: dbMock }));
vi.mock("./auth", () => ({
  requireWorkspace: vi.fn(async () => ({ workspaceId: "workspace-1", userId: "user-1", role: "owner" })),
}));

import {
  BenchmarkValidationError,
  benchmarkDetail,
  createPromptBenchmark,
  repository,
  repositoryBenchmarks,
  repositoryPrompts,
} from "./data";

describe("repository structure history", () => {
  beforeEach(() => {
    dbMock.mockReset();
    queryMock.mockReset();
    dbMock.mockResolvedValue({ query: queryMock });
  });

  it("returns chronological snapshots with distinct module counts as serializable numbers", async () => {
    queryMock
      .mockResolvedValueOnce([{ id: "repo-1", snapshot: {} }])
      .mockResolvedValueOnce([{
        id: "snapshot-1",
        captured_at: new Date("2026-08-30T12:00:00.000Z"),
        branch: "main",
        head_sha: "abcdef123456",
        dirty: false,
        total_source_loc: "12500",
        source_files: 84,
        modules: "7",
      }])
      .mockResolvedValueOnce([{
        sha: "a".repeat(40),
        author_name: "Ada Author",
        author_email: "ada@example.com",
        authored_at: new Date("2026-08-30T10:00:00.000Z"),
        committer_name: "Chris Committer",
        committer_email: "chris@example.com",
        committed_at: new Date("2026-08-30T11:00:00.000Z"),
        observed_branch: "main",
        first_observed_at: new Date("2026-08-30T12:00:00.000Z"),
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await repository("repo-1");

    expect(queryMock.mock.calls[0][0]).toContain("r.workspace_id=");
    expect(queryMock.mock.calls[0][1]).toEqual(["repo-1", "workspace-1"]);

    expect(result?.snapshots).toEqual([{
      id: "snapshot-1",
      capturedAt: "2026-08-30T12:00:00.000Z",
      branch: "main",
      headSha: "abcdef123456",
      dirty: false,
      totalSourceLoc: 12500,
      sourceFiles: 84,
      modules: 7,
      filesOver500Loc: 0,
      filesOver1000Loc: 0,
      dependencyCycleCount: 0,
      crossModuleEdgeRatio: 0,
      p95FanOut: 0,
      testToSourceRatio: 0,
      instructionBytes: 0,
    }]);
    expect(result?.commits[0]).toMatchObject({
      sha: "a".repeat(40),
      authorName: "Ada Author",
      committerName: "Chris Committer",
      committedAt: "2026-08-30T11:00:00.000Z",
    });
    expect(queryMock.mock.calls[1][0]).toContain("count(distinct nullif(f.module_name,''))::int modules");
    expect(queryMock.mock.calls[1][0]).toContain("order by s.captured_at,s.id");
    expect(queryMock.mock.calls[1][1]).toEqual(["repo-1"]);
    expect(queryMock.mock.calls[2][0]).toContain("from repo_commits");
    expect(queryMock.mock.calls[2][1]).toEqual(["repo-1"]);
  });
});

describe("repository prompt search", () => {
  beforeEach(() => {
    dbMock.mockReset();
    queryMock.mockReset();
    dbMock.mockResolvedValue({ query: queryMock });
  });

  it("searches full prompt bodies with a parameterized, case-insensitive literal pattern", async () => {
    queryMock.mockResolvedValueOnce([]);

    await repositoryPrompts("repo-1", "context", "gpt-test", "codex", "  Fix 100%_done\\path  ");

    expect(queryMock).toHaveBeenCalledOnce();
    expect(queryMock.mock.calls[0][0]).toContain("p.prompt_text ilike $5 escape '\\'");
    expect(queryMock.mock.calls[0][1]).toEqual([
      "repo-1",
      "gpt-test",
      "gpt-test",
      "codex",
      "%Fix 100\\%\\_done\\\\path%",
      "workspace-1",
    ]);
  });

  it("does not add a prompt predicate for an empty search", async () => {
    queryMock.mockResolvedValueOnce([]);

    await repositoryPrompts("repo-1", "context", undefined, undefined, "   ");

    expect(queryMock.mock.calls[0][0]).not.toContain("prompt_text ilike");
    expect(queryMock.mock.calls[0][1]).toEqual(["repo-1", null, "workspace-1"]);
  });
});

describe("prompt benchmarks", () => {
  beforeEach(() => {
    dbMock.mockReset();
    queryMock.mockReset();
    dbMock.mockResolvedValue({ query: queryMock });
  });

  it("creates an exact repository, provider, model, and fingerprint benchmark", async () => {
    queryMock
      .mockResolvedValueOnce([{
        id: "prompt-1",
        workspace_id: "workspace-1",
        repository_id: "repo-1",
        provider: "codex",
        prompt_text: "Fix the auth flow",
        prompt_fingerprint: "abc123",
        effective_model: "gpt-test",
        model_count: 1,
      }])
      .mockResolvedValueOnce([{ id: "benchmark-1", name: "Fix the auth flow", model: "gpt-test", provider: "codex" }]);

    await expect(createPromptBenchmark("repo-1", "prompt-1", "gpt-test"))
      .resolves.toMatchObject({ id: "benchmark-1" });
    expect(queryMock.mock.calls[0][0]).toContain("count(distinct coalesce(a.model,p.model))");
    expect(queryMock.mock.calls[1][0]).toContain("on conflict(repository_id,provider,model,prompt_fingerprint)");
    expect(queryMock.mock.calls[1][1]).toEqual([
      "workspace-1", "repo-1", "prompt-1", "Fix the auth flow", "codex", "gpt-test", "Fix the auth flow", "abc123",
    ]);
  });

  it("rejects a source prompt that used multiple models", async () => {
    queryMock.mockResolvedValueOnce([{
      id: "prompt-1",
      prompt_text: "Fix it",
      prompt_fingerprint: "abc123",
      effective_model: null,
      model_count: 2,
    }]);

    await expect(createPromptBenchmark("repo-1", "prompt-1"))
      .rejects.toEqual(new BenchmarkValidationError("Prompts that used multiple models cannot be benchmarked"));
    expect(queryMock).toHaveBeenCalledOnce();
  });

  it("lists historical matches using canonical text and the resolved single model", async () => {
    queryMock.mockResolvedValueOnce([]);
    await repositoryBenchmarks("repo-1");

    expect(queryMock.mock.calls[0][0]).toContain("p.prompt_fingerprint=b.prompt_fingerprint");
    expect(queryMock.mock.calls[0][0]).toContain("u.model_count <= 1");
    expect(queryMock.mock.calls[0][1]).toEqual(["repo-1", "workspace-1"]);
  });

  it("serializes benchmark observations for chart clients", async () => {
    queryMock
      .mockResolvedValueOnce([{
        id: "benchmark-1",
        repository_id: "repo-1",
        provider: "codex",
        model: "gpt-test",
        prompt_text: "Fix it\r\nnow",
        prompt_fingerprint: "abc123",
      }])
      .mockResolvedValueOnce([{
        id: "prompt-1",
        started_at: new Date("2026-09-01T10:00:00.000Z"),
        context_tokens: "1200",
        output_tokens: "80",
        cost_usd: "0.25",
        response_duration_ms: "950",
        files_read: 3,
        provisional: false,
      }]);

    const result = await benchmarkDetail("benchmark-1");

    expect(result?.points[0]).toMatchObject({
      id: "prompt-1",
      startedAt: "2026-09-01T10:00:00.000Z",
      contextTokens: 1200,
      outputTokens: 80,
      costUsd: 0.25,
      responseDurationMs: 950,
      filesRead: 3,
      provisional: false,
    });
    expect(queryMock.mock.calls[1][1]).toEqual(["repo-1", "codex", "abc123", "Fix it\nnow", "gpt-test"]);
  });
});
