import { describe, expect, it } from "vitest";
import { buildRepositoryStructureTrend, type RepositoryStructureSnapshot } from "./repository-structure-data";

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
  sourceFiles: totalSourceLoc / 10,
  modules: totalSourceLoc / 100,
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
