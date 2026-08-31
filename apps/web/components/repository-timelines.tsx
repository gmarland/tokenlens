"use client";

import { AgentBehaviour } from "./agent-behaviour";
import type { AgentBehaviourPrompt } from "./agent-behaviour-data";
import { RepositoryStructureTrend } from "./repository-structure-trend";
import type { RepositoryStructureSnapshot } from "./repository-structure-data";
import { RepositoryTimeFilterProvider } from "./repository-time-filters";
import { BackLink, Panel, SectionTitle, Toolbar } from "./ui";

export function RepositoryTimelines({
  prompts,
  snapshots,
  promptHref,
  behaviourKey,
}: {
  prompts: AgentBehaviourPrompt[];
  snapshots: RepositoryStructureSnapshot[];
  promptHref: string;
  behaviourKey: string;
}) {
  return <>
    <RepositoryTimeFilterProvider key={`behaviour:${behaviourKey}`} timestamps={prompts.map((prompt) => prompt.startedAt)}>
      <Toolbar><SectionTitle>Agent behaviour</SectionTitle><BackLink href={promptHref}>Explore prompts →</BackLink></Toolbar>
      <Panel><AgentBehaviour prompts={prompts} /></Panel>
    </RepositoryTimeFilterProvider>
    <RepositoryTimeFilterProvider key="structure" timestamps={snapshots.map((snapshot) => snapshot.capturedAt)}>
      <SectionTitle>Repository structure over time</SectionTitle>
      <Panel><RepositoryStructureTrend snapshots={snapshots} /></Panel>
    </RepositoryTimeFilterProvider>
  </>;
}
