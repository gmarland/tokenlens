import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, queryMock } = vi.hoisted(() => ({
  dbMock: vi.fn(),
  queryMock: vi.fn(),
}));

vi.mock("@tokenlens/database", () => ({ db: dbMock }));

import { repository, repositoryPrompts } from "./data";

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

    expect(result?.snapshots).toEqual([{
      id: "snapshot-1",
      capturedAt: "2026-08-30T12:00:00.000Z",
      branch: "main",
      headSha: "abcdef123456",
      dirty: false,
      totalSourceLoc: 12500,
      sourceFiles: 84,
      modules: 7,
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
    ]);
  });

  it("does not add a prompt predicate for an empty search", async () => {
    queryMock.mockResolvedValueOnce([]);

    await repositoryPrompts("repo-1", "context", undefined, undefined, "   ");

    expect(queryMock.mock.calls[0][0]).not.toContain("prompt_text ilike");
    expect(queryMock.mock.calls[0][1]).toEqual(["repo-1", null]);
  });
});
