import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { AnalysisFilters } from "../../../../components/filters";
import { PromptBenchmarks } from "../../../../components/prompt-benchmarks";
import { RepositoryNav } from "../../../../components/repository-nav";
import { BackLink, Eyebrow, Intro, Page, Toolbar } from "../../../../components/ui";
import { repository } from "../../../../lib/data";
import { repositoryBenchmarkSummaries } from "../../../../lib/insights";

export const dynamic = "force-dynamic";

export default async function Benchmarks({ params, searchParams }: PageProps<"/repos/[repositoryId]/benchmarks">) {
  const { repositoryId } = await params;
  const query = await searchParams;
  const provider = typeof query.provider === "string" ? query.provider : undefined;
  const model = typeof query.model === "string" ? query.model : undefined;
  const [repo, benchmarks] = await Promise.all([
    repository(repositoryId, model, provider),
    repositoryBenchmarkSummaries(repositoryId),
  ]);
  if (!repo) notFound();
  const filterQuery = new URLSearchParams();
  if (provider) filterQuery.set("provider", provider);
  if (model) filterQuery.set("model", model);
  const visibleBenchmarks = benchmarks.filter((benchmark) =>
    (!provider || benchmark.provider === provider) && (!model || benchmark.model === model));

  return <Page>
    <BackLink href="/">← All repositories</BackLink>
    <Toolbar>
      <Box sx={{ mt: 3 }}>
        <Eyebrow>Repeatable observations</Eyebrow>
        <Typography variant="h1">Prompt benchmarks · {repo.repo.name}</Typography>
        <Intro>Exact prompt and model matches tracked across repository revisions. Use the analysis filters to narrow benchmarks by their captured provider and model.</Intro>
      </Box>
      <AnalysisFilters
        idPrefix="benchmarks"
        initialProvider={provider}
        initialModel={model}
        providers={repo.providers.map((item: any) => ({ value: item.provider, label: item.provider }))}
        models={repo.models.map((item: any) => ({ value: item.model, label: item.model }))}
        modelLabel="Model"
      />
    </Toolbar>
    <RepositoryNav repositoryId={repositoryId} queryString={filterQuery.toString()} />
    <PromptBenchmarks benchmarks={visibleBenchmarks} />
  </Page>;
}
