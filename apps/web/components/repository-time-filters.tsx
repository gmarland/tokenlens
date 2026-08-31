"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { CustomTimeRange, TimeAggregation, TimeRange } from "./agent-behaviour-data";

type RepositoryTimeFilterContextValue = {
  aggregation: TimeAggregation;
  setAggregation: (aggregation: TimeAggregation) => void;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  customRange: CustomTimeRange | null;
  setCustomRange: (range: CustomTimeRange) => void;
  earliestTimestamp: string | null;
  latestTimestamp: string | null;
};

const RepositoryTimeFilterContext = createContext<RepositoryTimeFilterContextValue | null>(null);

export function RepositoryTimeFilterProvider({
  timestamps,
  children,
}: {
  timestamps: string[];
  children: ReactNode;
}) {
  const [aggregation, setAggregation] = useState<TimeAggregation>("day");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [customRange, setCustomRange] = useState<CustomTimeRange | null>(null);
  const values = timestamps.map(Date.parse).filter(Number.isFinite);
  const earliestTimestamp = values.length
    ? new Date(values.reduce((earliest, value) => Math.min(earliest, value), values[0])).toISOString()
    : null;
  const latestTimestamp = values.length
    ? new Date(values.reduce((latest, value) => Math.max(latest, value), values[0])).toISOString()
    : null;

  return <RepositoryTimeFilterContext.Provider value={{
    aggregation,
    setAggregation,
    timeRange,
    setTimeRange,
    customRange,
    setCustomRange,
    earliestTimestamp,
    latestTimestamp,
  }}>
    {children}
  </RepositoryTimeFilterContext.Provider>;
}

export function useRepositoryTimeFilters() {
  const value = useContext(RepositoryTimeFilterContext);
  if (!value) throw new Error("Repository time filters must be used within RepositoryTimeFilterProvider");
  return value;
}
