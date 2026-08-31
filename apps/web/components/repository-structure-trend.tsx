"use client";

import { useState } from "react";
import Typography from "@mui/material/Typography";
import type {
  AxisItemIdentifier,
  LineItemIdentifier,
} from "@mui/x-charts/models";
import { SeriesTrend } from "./charts";
import { EmptyState } from "./ui";
import {
  buildRepositoryCommitMarkers,
  buildRepositoryStructureTrend,
  type RepositoryCommit,
  type RepositoryStructureSnapshot,
} from "./repository-structure-data";
import { useRepositoryTimeFilters } from "./repository-time-filters";
import { TimeFilterControls } from "./time-filter-controls";
import { formatLocalTimestamp } from "../lib/date-time";

export function RepositoryStructureTrend({
  snapshots,
  commits,
}: {
  snapshots: RepositoryStructureSnapshot[];
  commits: RepositoryCommit[];
}) {
  const [highlightedAxis, setHighlightedAxis] = useState<AxisItemIdentifier[]>(
    [],
  );
  const [highlightedItem, setHighlightedItem] =
    useState<LineItemIdentifier | null>(null);
  const { aggregation, timeRange, customRange, latestTimestamp } =
    useRepositoryTimeFilters();

  if (!snapshots.length)
    return (
      <EmptyState>No repository snapshots have been captured yet.</EmptyState>
    );

  const trend = buildRepositoryStructureTrend(
    snapshots,
    aggregation,
    timeRange,
    customRange,
    latestTimestamp ?? undefined,
  );
  if (!trend.snapshots.length)
    return (
      <EmptyState>No repository snapshots match this time range.</EmptyState>
    );

  const snapshotByTimestamp = new Map(
    trend.timestamps.map((timestamp, index) => [
      timestamp,
      trend.snapshots[index],
    ]),
  );
  const commitMarkers = buildRepositoryCommitMarkers(
    commits,
    trend.observations,
    timeRange,
    customRange,
    latestTimestamp ?? undefined,
  );
  const interaction = {
    highlightedAxis,
    onHighlightedAxisChange: setHighlightedAxis,
    highlightedItem,
    onHighlightChange: setHighlightedItem,
  };
  const timestampValueFormatter = (
    timestamp: string,
    location: "tick" | "tooltip",
  ) => {
    if (location === "tick") {
      return formatLocalTimestamp(timestamp, "date");
    }
    const snapshot = snapshotByTimestamp.get(timestamp);
    const context = snapshot
      ? ` · ${snapshot.branch} · ${snapshot.headSha.slice(0, 7)}`
      : "";
    return `${formatLocalTimestamp(timestamp, "detail")}${context}`;
  };
  const commitLabelStep = Math.max(1, Math.ceil(commitMarkers.length / 10));
  const chart = (label: string, data: number[], showCommitLabels = false) => (
    <>
      <Typography variant="subtitle2" sx={{ mt: 2.5, mb: -1 }}>
        {label}
      </Typography>
      <SeriesTrend
        timestamps={trend.timestamps}
        series={[{ id: "repository", label, data }]}
        label={label}
        timestampValueFormatter={timestampValueFormatter}
        annotations={commitMarkers.map((commit, index) => ({
          timestamp: commit.committedAt,
          label: showCommitLabels && (index % commitLabelStep === 0 || index === commitMarkers.length - 1)
            ? `${commit.sha.slice(0, 7)} · ${commit.authorName || commit.authorEmail || "Unknown author"}`
            : undefined,
        }))}
        {...interaction}
      />
    </>
  );

  return (
    <>
      <TimeFilterControls idPrefix="repository-structure" />
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        Dashed markers show commit time and author. Times are shown in your local time zone.
        Commit messages are not collected.
      </Typography>
      {trend.snapshots.length === 1 && (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          One snapshot is available; future snapshots will form the trend line.
        </Typography>
      )}
      {chart(
        "Source LOC",
        trend.snapshots.map((snapshot) => snapshot.totalSourceLoc),
        true,
      )}
      {chart(
        "Source files",
        trend.snapshots.map((snapshot) => snapshot.sourceFiles),
      )}
      {chart(
        "Modules",
        trend.snapshots.map((snapshot) => snapshot.modules),
      )}
    </>
  );
}
