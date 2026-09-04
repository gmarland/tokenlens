import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { InsightCards } from "../../../../components/insight-cards";
import { AnalysisFilters } from "../../../../components/filters";
import { RepositoryNav } from "../../../../components/repository-nav";
import { BackLink, Eyebrow, Intro, Page, Panel } from "../../../../components/ui";
import { repository } from "../../../../lib/data";
import { repositoryInsightBundle, scopedInsightFilter } from "../../../../lib/insights";

export const dynamic = "force-dynamic";

export default async function RepositoryInsights({ params, searchParams }: PageProps<"/repos/[repositoryId]/insights">) {
  const { repositoryId } = await params;
  const query = await searchParams;
  const provider = typeof query.provider === "string" ? query.provider : undefined;
  const model = typeof query.model === "string" ? query.model : undefined;
  const range = typeof query.range === "string" ? query.range : undefined;
  const [repo, bundle] = await Promise.all([
    repository(repositoryId, model, provider),
    repositoryInsightBundle(repositoryId, scopedInsightFilter({ provider, model, range })),
  ]);
  if (!repo) notFound();
  const filterQuery = new URLSearchParams();
  if (provider) filterQuery.set("provider", provider);
  if (model) filterQuery.set("model", model);
  if (range) filterQuery.set("range", range);
  return <Page>
    <BackLink href="/dashboard">← All repositories</BackLink>
    <Eyebrow sx={{ mt: 3 }}>Recommended actions</Eyebrow>
    <Typography variant="h1">{repo.repo.name}</Typography>
    <Intro>Evidence-backed opportunities for {provider ?? "all providers"} · {model ?? "all models"}. Recommendations are experiments, not causal claims.</Intro>
    <AnalysisFilters
      idPrefix="insights"
      initialProvider={provider}
      initialModel={model}
      providers={repo.providers.map((item: any) => ({ value: item.provider, label: item.provider }))}
      models={repo.models.map((item: any) => ({ value: item.model, label: item.model }))}
      modelLabel="Model"
      initialRange={range}
      showTimeRange
    />
    <RepositoryNav repositoryId={repositoryId} queryString={filterQuery.toString()} />
    <Panel><InsightCards insights={bundle.insights} /></Panel>
  </Page>;
}
