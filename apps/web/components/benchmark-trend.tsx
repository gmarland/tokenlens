"use client";

import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { AxisItemIdentifier, LineItemIdentifier } from "@mui/x-charts/models";
import { useState } from "react";
import { SeriesTrend } from "./charts";

export type BenchmarkPoint = {
  id: string;
  startedAt: string;
  contextTokens: number;
  freshInputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
  costUsd: number | null;
  responseDurationMs: number;
  apiCalls: number;
  toolCalls: number;
  failedTools: number;
  filesRead: number;
  filesEdited: number;
  repeatedReads: number;
  timeToFirstEditMs: number | null;
  provisional: boolean;
};

const metrics = {
  contextTokens: { label: "Context tokens", axis: "Tokens" },
  freshInputTokens: { label: "Fresh input", axis: "Tokens" },
  cacheReadTokens: { label: "Cache read", axis: "Tokens" },
  cacheCreationTokens: { label: "Cache creation", axis: "Tokens" },
  outputTokens: { label: "Output tokens", axis: "Tokens" },
  responseDurationMs: { label: "Model response duration", axis: "Milliseconds" },
  costUsd: { label: "Cost", axis: "USD" },
  filesRead: { label: "Files read", axis: "Files" },
  filesEdited: { label: "Files edited", axis: "Files" },
  repeatedReads: { label: "Repeated reads", axis: "Reads" },
  toolCalls: { label: "Tool calls", axis: "Calls" },
  failedTools: { label: "Failed tool calls", axis: "Calls" },
  timeToFirstEditMs: { label: "Time to first edit", axis: "Milliseconds" },
} as const;

type Metric = keyof typeof metrics;

export function BenchmarkTrend({ points }: { points: BenchmarkPoint[] }) {
  const [metric, setMetric] = useState<Metric>("contextTokens");
  const [highlightedAxis, setHighlightedAxis] = useState<AxisItemIdentifier[]>([]);
  const [highlightedItem, setHighlightedItem] = useState<LineItemIdentifier | null>(null);
  const definition = metrics[metric];
  const rawData = points.map((point) => point[metric] as number | null);
  const rollingMedian = rawData.map((_, index) => {
    if (index < 4) return null;
    const window = rawData.slice(index - 4, index + 1).filter((value): value is number => value != null);
    if (window.length < 5) return null;
    window.sort((a, b) => a - b);
    return window[2];
  });

  return <Stack spacing={2}>
    <FormControl size="small" sx={{ width: 260 }}>
      <InputLabel id="benchmark-metric-label">Metric</InputLabel>
      <Select
        label="Metric"
        labelId="benchmark-metric-label"
        onChange={(event) => setMetric(event.target.value as Metric)}
        value={metric}
      >
        {Object.entries(metrics).map(([value, item]) =>
          <MenuItem key={value} value={value}>{item.label}</MenuItem>)}
      </Select>
    </FormControl>
    <SeriesTrend
      timestamps={points.map((point) => point.startedAt)}
      series={[
        { id: metric, label: definition.label, data: rawData },
        { id: `${metric}-median`, label: "Rolling median (5 runs)", data: rollingMedian },
      ]}
      label={definition.axis}
      highlightedAxis={highlightedAxis}
      onHighlightedAxisChange={setHighlightedAxis}
      highlightedItem={highlightedItem}
      onHighlightChange={setHighlightedItem}
    />
    {points.some((point) => point.provisional) ? <Typography color="text.secondary" variant="body2">
      The newest observation is provisional while telemetry is still arriving.
    </Typography> : null}
  </Stack>;
}
