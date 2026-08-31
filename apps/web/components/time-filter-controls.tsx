"use client";

import { useRef, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import {
  timeAggregationOptions,
  timeRangeOptions,
  type TimeAggregation,
  type TimeRange,
} from "./agent-behaviour-data";
import { useRepositoryTimeFilters } from "./repository-time-filters";

export function TimeFilterControls({ idPrefix }: { idPrefix: string }) {
  const {
    aggregation,
    setAggregation,
    timeRange,
    setTimeRange,
    customRange,
    setCustomRange,
    earliestTimestamp,
    latestTimestamp,
  } = useRepositoryTimeFilters();
  const earliestObservation = earliestTimestamp ? dayjs(earliestTimestamp) : null;
  const latestObservation = latestTimestamp ? dayjs(latestTimestamp) : null;
  const [customStart, setCustomStart] = useState<Dayjs | null>(earliestObservation);
  const [customEnd, setCustomEnd] = useState<Dayjs | null>(latestObservation);
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const rangeAnchorRef = useRef<HTMLDivElement>(null);
  const customRangeInvalid = !customStart || !customEnd || customStart.isAfter(customEnd, "day");

  function handleTimeRangeChange(event: SelectChangeEvent) {
    const nextRange = event.target.value as TimeRange;
    if (nextRange === "custom") setCustomRangeOpen(true);
    else setTimeRange(nextRange);
  }

  function applyCustomRange() {
    if (customRangeInvalid || !customStart || !customEnd) return;
    setCustomRange({ start: customStart.format("YYYY-MM-DD"), end: customEnd.format("YYYY-MM-DD") });
    setTimeRange("custom");
    setCustomRangeOpen(false);
  }

  return <>
    <Box sx={{ display: "flex", justifyContent: "flex-end", flexWrap: { xs: "wrap", sm: "nowrap" }, gap: 2, ml: { md: "auto" }, width: { xs: "100%", md: "auto" } }}>
      <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 220 } }}>
        <InputLabel id={`${idPrefix}-aggregation-label`}>Time aggregation</InputLabel>
        <Select
          labelId={`${idPrefix}-aggregation-label`}
          label="Time aggregation"
          value={aggregation}
          onChange={(event: SelectChangeEvent) => setAggregation(event.target.value as TimeAggregation)}
        >
          {timeAggregationOptions.map((option) => <MenuItem value={option.value} key={option.value}>
            {option.label}
          </MenuItem>)}
        </Select>
      </FormControl>
      <FormControl ref={rangeAnchorRef} size="small" sx={{ minWidth: { xs: "100%", sm: 280 } }}>
        <InputLabel id={`${idPrefix}-range-label`}>Time range</InputLabel>
        <Select
          labelId={`${idPrefix}-range-label`}
          label="Time range"
          value={timeRange}
          onChange={handleTimeRangeChange}
          renderValue={(value) => value === "custom" && customRange
            ? `${customRange.start} – ${customRange.end}`
            : timeRangeOptions.find((option) => option.value === value)?.label ?? value}
        >
          {timeRangeOptions.map((option) => <MenuItem value={option.value} key={option.value}>
            {option.label}
          </MenuItem>)}
        </Select>
      </FormControl>
    </Box>
    <Popover
      open={customRangeOpen}
      anchorEl={rangeAnchorRef.current}
      onClose={() => setCustomRangeOpen(false)}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
    >
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box sx={{ display: "grid", gap: 2, p: 2.5, width: { xs: 300, sm: 360 } }}>
          <Typography variant="subtitle2">Custom time range</Typography>
          <DatePicker
            label="From"
            value={customStart}
            onChange={setCustomStart}
            minDate={earliestObservation ?? undefined}
            maxDate={customEnd ?? latestObservation ?? undefined}
            slotProps={{ textField: { size: "small" } }}
          />
          <DatePicker
            label="To"
            value={customEnd}
            onChange={setCustomEnd}
            minDate={customStart ?? earliestObservation ?? undefined}
            maxDate={latestObservation ?? undefined}
            slotProps={{ textField: { size: "small" } }}
          />
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button onClick={() => setCustomRangeOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={customRangeInvalid} onClick={applyCustomRange}>Apply</Button>
          </Box>
        </Box>
      </LocalizationProvider>
    </Popover>
  </>;
}
