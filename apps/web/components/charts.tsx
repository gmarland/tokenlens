"use client";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { LineChart } from "@mui/x-charts/LineChart";
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

export function Trend({
  data,
  keys,
  labels = {},
}: {
  data: any[];
  keys: string[];
  labels?: Record<string, string>;
}) {
  const theme = useTheme();
  return <Box sx={{ width: "100%", minWidth: 0 }}>
    <LineChart
      height={260}
      dataset={data}
      xAxis={[{ dataKey: "date", scaleType: "point" }]}
      series={keys.map((key, index) => ({
        dataKey: key,
        label: labels[key] ?? key,
        color: index ? theme.palette.primary.main : theme.palette.info.main,
        showMark: false,
      }))}
      grid={{ horizontal: true, vertical: true }}
    />
  </Box>;
}

export function SeriesTrend({
  dates,
  series,
  label,
}: {
  dates: string[];
  series: Array<{ id: string; label: string; data: Array<number | null> }>;
  label: string;
}) {
  return <Box sx={{ width: "100%", minWidth: 0 }}>
    <LineChart
      height={280}
      hideLegend
      xAxis={[{ data: dates, scaleType: "point" }]}
      yAxis={[{ label }]}
      series={series.map((item) => ({
        ...item,
        connectNulls: true,
        showMark: item.data.filter((value) => value != null).length === 1,
      }))}
      grid={{ horizontal: true, vertical: true }}
    />
  </Box>;
}
