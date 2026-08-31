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
  dirty: boolean;
  totalSourceLoc: number;
  sourceFiles: number;
  modules: number;
};

export type RepositoryCommit = {
  sha: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  committerName: string;
  committerEmail: string;
  committedAt: string;
  observedBranch: string;
  firstObservedAt: string;
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
    observations: filtered,
  };
}

export function buildRepositoryCommitMarkers(
  commits: RepositoryCommit[],
  observations: RepositoryStructureSnapshot[],
  timeRange: TimeRange,
  customRange: CustomTimeRange | null,
  referenceTimestamp?: string,
) {
  if (!observations.length) return [];
  const filtered = filterByTimeRange(
    commits,
    (commit) => commit.committedAt,
    timeRange,
    customRange,
    referenceTimestamp,
  );
  const observedHeads = new Set(observations.map((snapshot) => snapshot.headSha));
  const observationTimes = observations.map((snapshot) => Date.parse(snapshot.capturedAt));
  const firstObservation = Math.min(...observationTimes);
  const lastObservation = Math.max(...observationTimes);

  return filtered.filter((commit) => {
    const committedAt = Date.parse(commit.committedAt);
    return observedHeads.has(commit.sha)
      || (committedAt >= firstObservation && committedAt <= lastObservation);
  });
}
