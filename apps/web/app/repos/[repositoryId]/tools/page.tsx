import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { ToolHealthDataTable } from "../../../../components/data-tables";
import { InsightCards } from "../../../../components/insight-cards";
import { RepositoryNav } from "../../../../components/repository-nav";
import {
  BackLink,
  Eyebrow,
  Intro,
  Page,
  Panel,
  SectionTitle,
  Toolbar,
} from "../../../../components/ui";
import { repository } from "../../../../lib/data";
import { repositoryInsightBundle } from "../../../../lib/insights";

export const dynamic = "force-dynamic";

export default async function Tools({
  params,
  searchParams,
}: {
  params: Promise<{ repositoryId: string }>;
  searchParams: Promise<{ tool?: string }>;
}) {
  const { repositoryId } = await params;
  const query = await searchParams;
  const [repo, bundle] = await Promise.all([
    repository(repositoryId),
    repositoryInsightBundle(repositoryId),
  ]);
  if (!repo) notFound();
  const insights = bundle.insights.filter(
    (insight) => insight.rule === "tool-failure-rate",
  );
  return (
    <Page>
      <Toolbar>
        <Box>
          <Eyebrow>Observed agent tools</Eyebrow>
          <Typography variant="h1">{repo.repo.name}</Typography>
          <Intro>
            Failure rates include only calls whose outcome telemetry is known.
            Missing durations and result sizes remain unavailable.
          </Intro>
        </Box>
      </Toolbar>
      <RepositoryNav repositoryId={repositoryId} />
      <SectionTitle>Recommended actions</SectionTitle>
      <Panel>
        <InsightCards insights={insights} />
      </Panel>
      <Box id="evidence" sx={{ mt: 8 }}>
        <SectionTitle>Evidence</SectionTitle>
        <ToolHealthDataTable rows={bundle.tools} initialTool={query.tool} />
      </Box>
    </Page>
  );
}
