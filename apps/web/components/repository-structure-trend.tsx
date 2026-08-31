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
  buildRepositoryStructureTrend,
  type RepositoryStructureSnapshot,
} from "./repository-structure-data";
import { useRepositoryTimeFilters } from "./repository-time-filters";
import { TimeFilterControls } from "./time-filter-controls";

export function RepositoryStructureTrend({
  snapshots,
}: {
  snapshots: RepositoryStructureSnapshot[];
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
    const date = new Date(timestamp);
    if (location === "tick") {
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "2-digit",
      });
    }
    const snapshot = snapshotByTimestamp.get(timestamp);
    const context = snapshot
      ? ` · ${snapshot.branch} · ${snapshot.headSha.slice(0, 7)}`
      : "";
    return `${date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })}${context}`;
  };
  const chart = (label: string, data: number[]) => (
    <>
      <Typography variant="subtitle2" sx={{ mt: 2.5, mb: -1 }}>
        {label}
      </Typography>
      <SeriesTrend
        timestamps={trend.timestamps}
        series={[{ id: "repository", label, data }]}
        label={label}
        timestampValueFormatter={timestampValueFormatter}
        {...interaction}
      />
    </>
  );

  return (
    <>
      <TimeFilterControls idPrefix="repository-structure" />
      {trend.snapshots.length === 1 && (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          One snapshot is available; future snapshots will form the trend line.
        </Typography>
      )}
      {chart(
        "Source LOC",
        trend.snapshots.map((snapshot) => snapshot.totalSourceLoc),
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
