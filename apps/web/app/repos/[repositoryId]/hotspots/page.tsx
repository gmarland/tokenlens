import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { HotspotsDataTable } from "../../../../components/data-tables";
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

export default async function Hotspots({
  params,
  searchParams,
}: {
  params: Promise<{ repositoryId: string }>;
  searchParams: Promise<{ file?: string }>;
}) {
  const { repositoryId } = await params;
  const query = await searchParams;
  const [repo, bundle] = await Promise.all([
    repository(repositoryId),
    repositoryInsightBundle(repositoryId),
  ]);
  if (!repo) notFound();
  const insights = bundle.insights.filter(
    (insight) => insight.rule === "file-hotspot",
  );
  return (
    <Page>
      <Toolbar>
        <Box>
          <Eyebrow>Observed agent hotspots</Eyebrow>
          <Typography variant="h1">{repo.repo.name}</Typography>
          <Intro>
            Files are ranked by observed traversal and context association.
            These relationships do not establish causation.
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
        <HotspotsDataTable rows={bundle.hotspots} initialFile={query.file} />
      </Box>
    </Page>
  );
}
