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

export function Trend({ data, keys }: { data: any[]; keys: string[] }) {
  const theme = useTheme();
  return <Box sx={{ width: "100%", minWidth: 0 }}>
    <LineChart
      height={260}
      dataset={data}
      xAxis={[{ dataKey: "date", scaleType: "point" }]}
      series={keys.map((key, index) => ({ dataKey: key, label: key, color: index ? theme.palette.primary.main : theme.palette.info.main, showMark: false }))}
      grid={{ horizontal: true, vertical: true }}
    />
  </Box>;
}
