"use client";

import React, { useState } from "react";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";

type Option = { label: string; value: string };

export function AnalysisFilters({
  idPrefix,
  initialModel,
  initialProvider,
  modelLabel,
  models,
  providers,
  initialRange,
  showTimeRange = false,
}: {
  idPrefix: string;
  initialModel?: string;
  initialProvider?: string;
  modelLabel: string;
  models: Option[];
  providers: Option[];
  initialRange?: string;
  showTimeRange?: boolean;
}) {
  const [provider, setProvider] = useState(initialProvider ?? "");
  const [model, setModel] = useState(initialModel ?? "");
  const [range, setRange] = useState(initialRange ?? "all");

  return (
    <Stack
      component="form"
      method="get"
      autoComplete="off"
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{ width: { xs: "100%", md: "auto" } }}
    >
      <FormControl size="small" sx={{ minWidth: 145 }}>
        <InputLabel id={`${idPrefix}-provider-label`} shrink>Provider</InputLabel>
        <Select
          displayEmpty
          labelId={`${idPrefix}-provider-label`}
          label="Provider"
          name={provider ? "provider" : undefined}
          value={provider}
          onChange={(event: SelectChangeEvent) => setProvider(event.target.value)}
          renderValue={(value) => providers.find((option) => option.value === value)?.label ?? "All providers"}
        >
          <MenuItem value="">All providers</MenuItem>
          {providers.map((option) => (
            <MenuItem value={option.value} key={option.value}>{option.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 210 }}>
        <InputLabel id={`${idPrefix}-model-label`} shrink>{modelLabel}</InputLabel>
        <Select
          displayEmpty
          labelId={`${idPrefix}-model-label`}
          label={modelLabel}
          name={model ? "model" : undefined}
          value={model}
          onChange={(event: SelectChangeEvent) => setModel(event.target.value)}
          renderValue={(value) => models.find((option) => option.value === value)?.label ?? "All models"}
        >
          <MenuItem value="">All models</MenuItem>
          {models.map((option) => (
            <MenuItem value={option.value} key={option.value}>{option.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      {showTimeRange ? <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel id={`${idPrefix}-range-label`}>Time range</InputLabel>
        <Select
          labelId={`${idPrefix}-range-label`}
          label="Time range"
          name="range"
          value={range}
          onChange={(event: SelectChangeEvent) => setRange(event.target.value)}
        >
          <MenuItem value="all">All time</MenuItem>
          <MenuItem value="7d">Last 7 days</MenuItem>
          <MenuItem value="30d">Last 30 days</MenuItem>
          <MenuItem value="90d">Last 90 days</MenuItem>
        </Select>
      </FormControl> : null}
      <Button type="submit" variant="contained">Apply</Button>
    </Stack>
  );
}
