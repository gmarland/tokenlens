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
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import type { AxisItemIdentifier, LineItemIdentifier } from "@mui/x-charts/models";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { SeriesTrend } from "./charts";
import { EmptyState } from "./ui";
import {
  buildAggregatedBehaviourTrend,
  filterBehaviourPromptsByRange,
  groupBehaviourPrompts,
  timeAggregationOptions,
  timeRangeOptions,
  type AgentBehaviourPrompt,
  type BehaviourDimension,
  type BehaviourGroup,
  type CustomTimeRange,
  type TimeAggregation,
  type TimeRange,
} from "./agent-behaviour-data";

function BehaviourMetricCharts({
  prompts,
  groups,
  aggregation,
}: {
  prompts: AgentBehaviourPrompt[];
  groups: BehaviourGroup[];
  aggregation: TimeAggregation;
}) {
  const contextTrend = buildAggregatedBehaviourTrend(prompts, groups, "context", aggregation);
  const filesTrend = buildAggregatedBehaviourTrend(prompts, groups, "files", aggregation);
  const [highlightedAxis, setHighlightedAxis] = useState<AxisItemIdentifier[]>([]);
  const [highlightedItem, setHighlightedItem] = useState<LineItemIdentifier | null>(null);

  const interaction = {
    highlightedAxis,
    onHighlightedAxisChange: setHighlightedAxis,
    highlightedItem,
    onHighlightChange: setHighlightedItem,
  };

  return <>
    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
      Values show the median per UTC {aggregation}.
    </Typography>
    <SeriesTrend
      timestamps={contextTrend.timestamps}
      series={contextTrend.series}
      label="Median context tokens"
      {...interaction}
    />
    <SeriesTrend
      timestamps={filesTrend.timestamps}
      series={filesTrend.series}
      label="Median files read"
      {...interaction}
    />
  </>;
}

function GroupTrend({
  dimension,
  groups,
  prompts,
  aggregation,
  selected,
}: {
  dimension: BehaviourDimension;
  groups: BehaviourGroup[];
  prompts: AgentBehaviourPrompt[];
  aggregation: TimeAggregation;
  selected: string;
}) {
  const allKey = `${dimension}:all`;
  const allLabel = dimension === "branch" ? "All branches" : "All users";
  const options = prompts.length
    ? [{ key: allKey, label: allLabel, prompts }, ...groups]
    : groups;
  const group = options.find((candidate) => candidate.key === selected) ?? options[0];

  if (!group) return <EmptyState>No {dimension === "branch" ? "branch" : "user"} data matches these filters.</EmptyState>;

  const visibleGroups = group.key === allKey
    ? groups
    : groups.filter((candidate) => candidate.key === group.key);

  return <BehaviourMetricCharts
      key={`${group.key}:${aggregation}`}
      prompts={group.prompts}
      groups={visibleGroups}
      aggregation={aggregation}
    />;
}

export function AgentBehaviour({ prompts }: { prompts: AgentBehaviourPrompt[] }) {
  const [tab, setTab] = useState(0);
  const [aggregation, setAggregation] = useState<TimeAggregation>("day");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [selectedBranch, setSelectedBranch] = useState("branch:all");
  const [selectedUser, setSelectedUser] = useState("user:all");
  const earliestPrompt = prompts.length
    ? dayjs(Math.min(...prompts.map((prompt) => Date.parse(prompt.startedAt))))
    : null;
  const latestPrompt = prompts.length
    ? dayjs(Math.max(...prompts.map((prompt) => Date.parse(prompt.startedAt))))
    : null;
  const [customStart, setCustomStart] = useState<Dayjs | null>(earliestPrompt);
  const [customEnd, setCustomEnd] = useState<Dayjs | null>(latestPrompt);
  const [customRange, setCustomRange] = useState<CustomTimeRange | null>(null);
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const rangeAnchorRef = useRef<HTMLDivElement>(null);
  const filteredPrompts = filterBehaviourPromptsByRange(prompts, timeRange, customRange);
  const branches = groupBehaviourPrompts(filteredPrompts, "branch");
  const users = groupBehaviourPrompts(filteredPrompts, "user");
  const overall = [{ key: "overall", label: "All prompts", prompts: filteredPrompts }];
  const branchOptions = filteredPrompts.length
    ? [{ key: "branch:all", label: "All branches", prompts: filteredPrompts }, ...branches]
    : [];
  const userOptions = filteredPrompts.length
    ? [{ key: "user:all", label: "All users", prompts: filteredPrompts }, ...users]
    : [];
  const activeDimension: BehaviourDimension | null = tab === 1 ? "branch" : tab === 2 ? "user" : null;
  const activeOptions = activeDimension === "branch" ? branchOptions : activeDimension === "user" ? userOptions : [];
  const activeSelected = activeDimension === "branch" ? selectedBranch : selectedUser;
  const activeGroup = activeOptions.find((option) => option.key === activeSelected) ?? activeOptions[0];
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

  return <Box>
    <Tabs
      value={tab}
      onChange={(_event, value: number) => setTab(value)}
      aria-label="Agent behaviour views"
      variant="scrollable"
      scrollButtons="auto"
    >
      <Tab id="agent-behaviour-tab-overall" aria-controls="agent-behaviour-panel-overall" label="Overall" />
      <Tab id="agent-behaviour-tab-branch" aria-controls="agent-behaviour-panel-branch" label="Per branch" />
      <Tab id="agent-behaviour-tab-user" aria-controls="agent-behaviour-panel-user" label="Per user" />
    </Tabs>
    <Box sx={{ display: "flex", alignItems: "center", flexWrap: { xs: "wrap", md: "nowrap" }, gap: 2, mt: 2.5 }}>
      {activeDimension && activeGroup && <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 280 } }}>
        <InputLabel id={`agent-behaviour-${activeDimension}-label`}>
          {activeDimension === "branch" ? "Branch" : "User"}
        </InputLabel>
        <Select
          labelId={`agent-behaviour-${activeDimension}-label`}
          label={activeDimension === "branch" ? "Branch" : "User"}
          value={activeGroup.key}
          onChange={(event: SelectChangeEvent) => activeDimension === "branch"
            ? setSelectedBranch(event.target.value)
            : setSelectedUser(event.target.value)}
        >
          {activeOptions.map((option) => <MenuItem value={option.key} key={option.key}>
            {option.label} ({option.prompts.length})
          </MenuItem>)}
        </Select>
      </FormControl>}
      <Box sx={{ display: "flex", flexWrap: { xs: "wrap", sm: "nowrap" }, gap: 2, ml: { md: "auto" }, width: { xs: "100%", md: "auto" } }}>
        <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 220 } }}>
          <InputLabel id="agent-behaviour-aggregation-label">Time aggregation</InputLabel>
          <Select
            labelId="agent-behaviour-aggregation-label"
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
          <InputLabel id="agent-behaviour-range-label">Time range</InputLabel>
          <Select
            labelId="agent-behaviour-range-label"
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
            minDate={earliestPrompt ?? undefined}
            maxDate={customEnd ?? latestPrompt ?? undefined}
            slotProps={{ textField: { size: "small" } }}
          />
          <DatePicker
            label="To"
            value={customEnd}
            onChange={setCustomEnd}
            minDate={customStart ?? earliestPrompt ?? undefined}
            maxDate={latestPrompt ?? undefined}
            slotProps={{ textField: { size: "small" } }}
          />
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button onClick={() => setCustomRangeOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={customRangeInvalid} onClick={applyCustomRange}>Apply</Button>
          </Box>
        </Box>
      </LocalizationProvider>
    </Popover>
    <Box role="tabpanel" id="agent-behaviour-panel-overall" aria-labelledby="agent-behaviour-tab-overall" hidden={tab !== 0}>
      {tab === 0 && (filteredPrompts.length
        ? <BehaviourMetricCharts
            key={`${aggregation}:${timeRange}`}
            prompts={filteredPrompts}
            groups={overall}
            aggregation={aggregation}
          />
        : <EmptyState>No prompts match this time range.</EmptyState>)}
    </Box>
    <Box role="tabpanel" id="agent-behaviour-panel-branch" aria-labelledby="agent-behaviour-tab-branch" hidden={tab !== 1}>
      {tab === 1 && <GroupTrend
        key={timeRange}
        dimension="branch"
        groups={branches}
        prompts={filteredPrompts}
        aggregation={aggregation}
        selected={activeGroup?.key ?? "branch:all"}
      />}
    </Box>
    <Box role="tabpanel" id="agent-behaviour-panel-user" aria-labelledby="agent-behaviour-tab-user" hidden={tab !== 2}>
      {tab === 2 && <GroupTrend
        key={timeRange}
        dimension="user"
        groups={users}
        prompts={filteredPrompts}
        aggregation={aggregation}
        selected={activeGroup?.key ?? "user:all"}
      />}
    </Box>
  </Box>;
}
