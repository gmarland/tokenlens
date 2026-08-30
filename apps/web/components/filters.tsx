"use client";

import { useState } from "react";
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
  modelPlaceholder,
  models,
  providers,
}: {
  idPrefix: string;
  initialModel?: string;
  initialProvider?: string;
  modelLabel: string;
  modelPlaceholder: string;
  models: Option[];
  providers: Option[];
}) {
  const [provider, setProvider] = useState(initialProvider ?? "");
  const [model, setModel] = useState(initialModel ?? "");

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
        <InputLabel id={`${idPrefix}-provider-label`}>Provider</InputLabel>
        <Select
          labelId={`${idPrefix}-provider-label`}
          label="Provider"
          name="provider"
          value={provider}
          onChange={(event: SelectChangeEvent) => setProvider(event.target.value)}
        >
          <MenuItem value="">All providers</MenuItem>
          {providers.map((option) => (
            <MenuItem value={option.value} key={option.value}>{option.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 210 }}>
        <InputLabel id={`${idPrefix}-model-label`}>{modelLabel}</InputLabel>
        <Select
          labelId={`${idPrefix}-model-label`}
          label={modelLabel}
          name="model"
          value={model}
          onChange={(event: SelectChangeEvent) => setModel(event.target.value)}
        >
          <MenuItem value="">{modelPlaceholder}</MenuItem>
          {models.map((option) => (
            <MenuItem value={option.value} key={option.value}>{option.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button type="submit" variant="contained">Apply</Button>
    </Stack>
  );
}
