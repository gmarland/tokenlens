"use client";

import { AgentBehaviour } from "./agent-behaviour";
import type { AgentBehaviourPrompt } from "./agent-behaviour-data";
import { RepositoryStructureTrend } from "./repository-structure-trend";
import type {
  RepositoryCommit,
  RepositoryStructureSnapshot,
} from "./repository-structure-data";
import { RepositoryTimeFilterProvider } from "./repository-time-filters";
import { BackLink, Panel, SectionTitle, Toolbar } from "./ui";
import Box from "@mui/material/Box";

export function RepositoryBehaviourTimeline({
  prompts,
  promptHref,
  behaviourKey,
}: {
  prompts: AgentBehaviourPrompt[];
  promptHref: string;
  behaviourKey: string;
}) {
  return (
    <RepositoryTimeFilterProvider
      key={`behaviour:${behaviourKey}`}
      timestamps={prompts.map((prompt) => prompt.startedAt)}
    >
      <Box sx={{ mt: 6, mb: 2 }}>
        <Toolbar>
          <SectionTitle>Agent behaviour over time</SectionTitle>
          <BackLink href={promptHref}>Explore prompts →</BackLink>
        </Toolbar>
      </Box>
      <Panel>
        <AgentBehaviour prompts={prompts} />
      </Panel>
    </RepositoryTimeFilterProvider>
  );
}

export function RepositoryStructureTimeline({
  snapshots,
  commits,
}: {
  snapshots: RepositoryStructureSnapshot[];
  commits: RepositoryCommit[];
}) {
  return (
    <RepositoryTimeFilterProvider
      key="structure"
      timestamps={snapshots.map((snapshot) => snapshot.capturedAt)}
    >
      <SectionTitle>Repository structure over time</SectionTitle>
      <Panel>
        <RepositoryStructureTrend snapshots={snapshots} commits={commits} />
      </Panel>
    </RepositoryTimeFilterProvider>
  );
}
