import { describe, expect, it } from "vitest";
import {
  buildRepositoryCommitMarkers,
  buildRepositoryStructureTrend,
  type RepositoryCommit,
  type RepositoryStructureSnapshot,
} from "./repository-structure-data";

const snapshot = (
  id: string,
  capturedAt: string,
  totalSourceLoc: number,
): RepositoryStructureSnapshot => ({
  id,
  capturedAt,
  totalSourceLoc,
  branch: "main",
  headSha: id,
  dirty: false,
  sourceFiles: totalSourceLoc / 10,
  modules: totalSourceLoc / 100,
});

const commit = (sha: string, committedAt: string): RepositoryCommit => ({
  sha,
  committedAt,
  authoredAt: committedAt,
  authorName: "Ada Author",
  authorEmail: "ada@example.com",
  committerName: "Chris Committer",
  committerEmail: "chris@example.com",
  observedBranch: "main",
  firstObservedAt: committedAt,
});

describe("buildRepositoryCommitMarkers", () => {
  it("keeps observed heads and commits between structure observations", () => {
    const observations = [
      snapshot("first-head", "2026-08-30T12:00:00.000Z", 100),
      snapshot("last-head", "2026-08-31T12:00:00.000Z", 200),
    ];
    const markers = buildRepositoryCommitMarkers([
      commit("unrelated-old", "2026-08-01T12:00:00.000Z"),
      commit("first-head", "2026-08-29T12:00:00.000Z"),
      commit("between", "2026-08-30T18:00:00.000Z"),
      commit("last-head", "2026-08-31T10:00:00.000Z"),
    ], observations, "all", null);

    expect(markers.map((item) => item.sha)).toEqual(["first-head", "between", "last-head"]);
  });

  it("applies the repository structure time range", () => {
    const observations = [snapshot("recent", "2026-08-31T12:00:00.000Z", 200)];
    expect(buildRepositoryCommitMarkers([
      commit("old", "2026-08-01T12:00:00.000Z"),
      commit("recent", "2026-08-31T10:00:00.000Z"),
    ], observations, "7d", null, "2026-08-31T12:00:00.000Z").map((item) => item.sha))
      .toEqual(["recent"]);
  });
});

describe("buildRepositoryStructureTrend", () => {
  it("uses the latest snapshot in each aggregation bucket", () => {
    const trend = buildRepositoryStructureTrend([
      snapshot("first", "2026-08-30T09:00:00.000Z", 100),
      snapshot("latest", "2026-08-30T17:00:00.000Z", 200),
      snapshot("next", "2026-08-31T12:00:00.000Z", 300),
    ], "day", "all", null);

    expect(trend.timestamps).toEqual([
      "2026-08-30T00:00:00.000Z",
      "2026-08-31T00:00:00.000Z",
    ]);
    expect(trend.snapshots.map((item) => item.id)).toEqual(["latest", "next"]);
  });

  it("applies the shared relative and custom time ranges", () => {
    const snapshots = [
      snapshot("old", "2026-07-01T12:00:00.000Z", 100),
      snapshot("recent", "2026-08-30T12:00:00.000Z", 200),
    ];

    expect(buildRepositoryStructureTrend(
      snapshots,
      "day",
      "7d",
      null,
      "2026-08-31T12:00:00.000Z",
    ).snapshots.map((item) => item.id)).toEqual(["recent"]);
    expect(buildRepositoryStructureTrend(
      snapshots,
      "day",
      "custom",
      { start: "2026-07-01", end: "2026-07-01" },
    ).snapshots.map((item) => item.id)).toEqual(["old"]);
  });
});
