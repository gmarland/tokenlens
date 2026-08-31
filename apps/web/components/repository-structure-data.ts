import {
  behaviourBucketStart,
  filterByTimeRange,
  type CustomTimeRange,
  type TimeAggregation,
  type TimeRange,
} from "./agent-behaviour-data";

export type RepositoryStructureSnapshot = {
  id: string;
  capturedAt: string;
  branch: string;
  headSha: string;
  totalSourceLoc: number;
  sourceFiles: number;
  modules: number;
};

export function buildRepositoryStructureTrend(
  snapshots: RepositoryStructureSnapshot[],
  aggregation: TimeAggregation,
  timeRange: TimeRange,
  customRange: CustomTimeRange | null,
  referenceTimestamp?: string,
) {
  const filtered = filterByTimeRange(
    snapshots,
    (snapshot) => snapshot.capturedAt,
    timeRange,
    customRange,
    referenceTimestamp,
  );
  const latestByBucket = new Map<string, RepositoryStructureSnapshot>();

  for (const snapshot of filtered) {
    const timestamp = behaviourBucketStart(snapshot.capturedAt, aggregation);
    const current = latestByBucket.get(timestamp);
    if (!current || Date.parse(snapshot.capturedAt) > Date.parse(current.capturedAt)) {
      latestByBucket.set(timestamp, snapshot);
    }
  }

  const timestamps = [...latestByBucket.keys()].sort();
  return {
    timestamps,
    snapshots: timestamps.map((timestamp) => latestByBucket.get(timestamp)!),
  };
}
