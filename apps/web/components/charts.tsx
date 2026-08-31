"use client";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { LineChart, lineClasses } from "@mui/x-charts/LineChart";
import type { AxisItemIdentifier, LineItemIdentifier } from "@mui/x-charts/models";
import { ScatterChart } from "@mui/x-charts/ScatterChart";

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
  highlightedAxis,
  onHighlightedAxisChange,
  highlightedItem,
  onHighlightChange,
}: {
  timestamps: string[];
  series: Array<{ id: string; label: string; data: Array<number | null> }>;
  label: string;
  highlightedAxis: AxisItemIdentifier[];
  onHighlightedAxisChange: (axis: AxisItemIdentifier[]) => void;
  highlightedItem: LineItemIdentifier | null;
  onHighlightChange: (item: LineItemIdentifier | null) => void;
}) {
  const dates = timestamps.map((timestamp) => new Date(timestamp));

  return <Box sx={{ width: "100%", minWidth: 0 }}>
    <LineChart
      height={280}
      hideLegend
      xAxis={[{
        id: "time",
        data: dates,
        scaleType: "time",
        tickLabelMinGap: 36,
        valueFormatter: (value: Date, context) => context.location === "tick"
          ? value.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
          : value.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" }),
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
    />
  </Box>;
}
