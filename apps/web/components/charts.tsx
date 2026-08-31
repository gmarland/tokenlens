"use client";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { LineChart, lineClasses } from "@mui/x-charts/LineChart";
import { ChartsReferenceLine } from "@mui/x-charts/ChartsReferenceLine";
import type { AxisItemIdentifier, LineItemIdentifier } from "@mui/x-charts/models";
import { ScatterChart } from "@mui/x-charts/ScatterChart";
import { formatLocalTimestamp } from "../lib/date-time";

export function ScatterPlot({ data, x, y }: { data: any[]; x: string; y: string }) {
  const theme = useTheme();
  return <Box sx={{ width: "100%", minWidth: 0 }}>
    <ScatterChart
      height={280}
      dataset={data}
      series={[{ datasetKeys: { x, y }, label: `${x} vs ${y}`, color: theme.palette.info.main }]}
      xAxis={[{ label: x }]}
      yAxis={[{ label: y }]}
      grid={{ horizontal: true, vertical: true }}
    />
  </Box>;
}

export function SeriesTrend({
  timestamps,
  series,
  label,
  timestampValueFormatter,
  annotations = [],
  highlightedAxis,
  onHighlightedAxisChange,
  highlightedItem,
  onHighlightChange,
}: {
  timestamps: string[];
  series: Array<{ id: string; label: string; data: Array<number | null> }>;
  label: string;
  timestampValueFormatter?: (timestamp: string, location: "tick" | "tooltip") => string;
  annotations?: Array<{ timestamp: string; label?: string }>;
  highlightedAxis: AxisItemIdentifier[];
  onHighlightedAxisChange: (axis: AxisItemIdentifier[]) => void;
  highlightedItem: LineItemIdentifier | null;
  onHighlightChange: (item: LineItemIdentifier | null) => void;
}) {
  const dates = timestamps.map((timestamp) => new Date(timestamp));
  // Annotations describe the series; they must not extend its observed range.
  const domainValues = dates.map((date) => date.getTime()).filter(Number.isFinite);
  const domainMin = Math.min(...domainValues);
  const domainMax = Math.max(...domainValues);

  return <Box sx={{ width: "100%", minWidth: 0 }}>
    <LineChart
      height={280}
      hideLegend
      xAxis={[{
        id: "time",
        data: dates,
        scaleType: "time",
        ...(domainMax > domainMin ? { min: new Date(domainMin), max: new Date(domainMax) } : {}),
        tickLabelMinGap: 36,
        valueFormatter: (value: Date, context) => timestampValueFormatter
          ? timestampValueFormatter(value.toISOString(), context.location === "tick" ? "tick" : "tooltip")
          : context.location === "tick"
            ? formatLocalTimestamp(value, "compact")
            : formatLocalTimestamp(value, "detail"),
      }]}
      yAxis={[{ label }]}
      axisHighlight={{ x: "line" }}
      highlightedAxis={highlightedAxis}
      onHighlightedAxisChange={onHighlightedAxisChange}
      highlightedItem={highlightedItem}
      onHighlightChange={onHighlightChange}
      series={series.map((item) => ({
        ...item,
        connectNulls: true,
        showMark: true,
      }))}
      grid={{ horizontal: true, vertical: true }}
      sx={{ [`& .${lineClasses.line}`]: { strokeWidth: 1.5 } }}
    >
      {annotations.map((annotation) => <ChartsReferenceLine
        key={`${annotation.timestamp}:${annotation.label ?? ""}`}
        x={new Date(annotation.timestamp)}
        axisId="time"
        label={annotation.label}
        labelAlign="start"
        lineStyle={{ stroke: "#777", strokeDasharray: "4 3", strokeWidth: 1 }}
        labelStyle={{ fontSize: 10, fill: "#555" }}
      />)}
    </LineChart>
  </Box>;
}
