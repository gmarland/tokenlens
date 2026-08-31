"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { SeriesTrend, Trend } from "./charts";
import { EmptyState } from "./ui";
import {
  buildUserTrendSeries,
  groupBehaviourPrompts,
  type AgentBehaviourPrompt,
  type BehaviourDimension,
  type BehaviourGroup,
} from "./agent-behaviour-data";

const ALL_USERS_KEY = "user:all";

function GroupTrend({
  dimension,
  groups,
  prompts,
}: {
  dimension: BehaviourDimension;
  groups: BehaviourGroup[];
  prompts: AgentBehaviourPrompt[];
}) {
  const options = dimension === "user" && prompts.length
    ? [{ key: ALL_USERS_KEY, label: "All users", prompts }, ...groups]
    : groups;
  const [selected, setSelected] = useState(options[0]?.key ?? "");
  const group = options.find((candidate) => candidate.key === selected) ?? options[0];
  const label = dimension === "branch" ? "Branch" : "User";

  if (!group) return <EmptyState>No {dimension === "branch" ? "branch" : "user"} data matches these filters.</EmptyState>;

  const visibleUsers = dimension === "user"
    ? group.key === ALL_USERS_KEY ? groups : groups.filter((user) => user.key === group.key)
    : [];

  return <>
    <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 280 }, mt: 2.5 }}>
      <InputLabel id={`agent-behaviour-${dimension}-label`}>{label}</InputLabel>
      <Select
        labelId={`agent-behaviour-${dimension}-label`}
        label={label}
        value={group.key}
        onChange={(event: SelectChangeEvent) => setSelected(event.target.value)}
      >
        {options.map((option) => <MenuItem value={option.key} key={option.key}>
          {option.label} ({option.prompts.length})
        </MenuItem>)}
      </Select>
    </FormControl>
    {dimension === "user" ? <>
      <SeriesTrend
        dates={group.prompts.map((prompt) => prompt.date)}
        series={buildUserTrendSeries(group.prompts, visibleUsers, "context")}
        label="Context tokens"
      />
      <SeriesTrend
        dates={group.prompts.map((prompt) => prompt.date)}
        series={buildUserTrendSeries(group.prompts, visibleUsers, "files")}
        label="Files read"
      />
    </> : <Trend
      data={group.prompts}
      keys={["context", "files"]}
      labels={{ context: "Context tokens", files: "Files read" }}
    />}
  </>;
}

export function AgentBehaviour({ prompts }: { prompts: AgentBehaviourPrompt[] }) {
  const [tab, setTab] = useState(0);
  const branches = groupBehaviourPrompts(prompts, "branch");
  const users = groupBehaviourPrompts(prompts, "user");

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
    <Box role="tabpanel" id="agent-behaviour-panel-overall" aria-labelledby="agent-behaviour-tab-overall" hidden={tab !== 0}>
      {tab === 0 && (prompts.length
        ? <Trend data={prompts} keys={["context", "files"]} labels={{ context: "Context tokens", files: "Files read" }} />
        : <EmptyState>No prompts match these filters.</EmptyState>)}
    </Box>
    <Box role="tabpanel" id="agent-behaviour-panel-branch" aria-labelledby="agent-behaviour-tab-branch" hidden={tab !== 1}>
      {tab === 1 && <GroupTrend dimension="branch" groups={branches} prompts={prompts} />}
    </Box>
    <Box role="tabpanel" id="agent-behaviour-panel-user" aria-labelledby="agent-behaviour-tab-user" hidden={tab !== 2}>
      {tab === 2 && <GroupTrend dimension="user" groups={users} prompts={prompts} />}
    </Box>
  </Box>;
}
