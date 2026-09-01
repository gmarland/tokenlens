import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { HotspotsDataTable } from "../../../../components/data-tables";
import { AnalysisFilters } from "../../../../components/filters";
import { InsightCards } from "../../../../components/insight-cards";
import { RepositoryNav } from "../../../../components/repository-nav";
import { BackLink, Eyebrow, Intro, Page, Panel, SectionTitle } from "../../../../components/ui";
import { repository } from "../../../../lib/data";
import { repositoryInsightBundle, scopedInsightFilter } from "../../../../lib/insights";

export const dynamic = "force-dynamic";

export default async function Hotspots({ params, searchParams }: {
  params: Promise<{ repositoryId: string }>;
  searchParams: Promise<{ provider?: string; model?: string; range?: string; file?: string }>;
}) {
  const { repositoryId } = await params;
  const query = await searchParams;
  const [repo, bundle] = await Promise.all([
    repository(repositoryId, query.model, query.provider),
    repositoryInsightBundle(repositoryId, scopedInsightFilter(query)),
  ]);
  if (!repo) notFound();
  const insights = bundle.insights.filter((insight) => insight.rule === "file-hotspot");
  const filterQuery = new URLSearchParams();
  if (query.provider) filterQuery.set("provider", query.provider);
  if (query.model) filterQuery.set("model", query.model);
  if (query.range) filterQuery.set("range", query.range);
  return <Page>
    <BackLink href="/">← All repositories</BackLink>
    <Eyebrow sx={{ mt: 3 }}>Repository diagnostics</Eyebrow>
    <Typography variant="h1">File hotspots · {repo.repo.name}</Typography>
    <Intro>Files are ranked by observed traversal and context association. These relationships do not establish causation.</Intro>
    <AnalysisFilters
      idPrefix="hotspots"
      initialProvider={query.provider}
      initialModel={query.model}
      providers={repo.providers.map((item: any) => ({ value: item.provider, label: item.provider }))}
      models={repo.models.map((item: any) => ({ value: item.model, label: item.model }))}
      modelLabel="Model"
      initialRange={query.range}
      showTimeRange
    />
    <RepositoryNav repositoryId={repositoryId} queryString={filterQuery.toString()} />
    <SectionTitle>Recommended actions</SectionTitle>
    <Panel><InsightCards insights={insights} /></Panel>
    <Box id="evidence" sx={{ scrollMarginTop: 16 }}>
      <SectionTitle>Evidence</SectionTitle>
      <HotspotsDataTable rows={bundle.hotspots} initialFile={query.file} />
    </Box>
  </Page>;
}
