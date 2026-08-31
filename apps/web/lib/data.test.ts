import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, queryMock } = vi.hoisted(() => ({
  dbMock: vi.fn(),
  queryMock: vi.fn(),
}));

vi.mock("@tokenlens/database", () => ({ db: dbMock }));

import { repository } from "./data";

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
        total_source_loc: "12500",
        source_files: 84,
        modules: "7",
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
      totalSourceLoc: 12500,
      sourceFiles: 84,
      modules: 7,
    }]);
    expect(queryMock.mock.calls[1][0]).toContain("count(distinct nullif(f.module_name,''))::int modules");
    expect(queryMock.mock.calls[1][0]).toContain("order by s.captured_at,s.id");
    expect(queryMock.mock.calls[1][1]).toEqual(["repo-1"]);
  });
});
