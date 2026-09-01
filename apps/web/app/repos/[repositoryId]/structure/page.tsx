import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { AnalysisFilters } from "../../../../components/filters";
import { RepositoryNav } from "../../../../components/repository-nav";
import { RepositoryStructureTimeline } from "../../../../components/repository-timelines";
import { BackLink, Cards, Eyebrow, Intro, Page, SectionTitle, StatCard, Toolbar } from "../../../../components/ui";
import { repository } from "../../../../lib/data";
import { compact } from "../../../../lib/format";

export const dynamic = "force-dynamic";

export default async function Structure({ params, searchParams }: PageProps<"/repos/[repositoryId]/structure">) {
  const { repositoryId } = await params;
  const query = await searchParams;
  const provider = typeof query.provider === "string" ? query.provider : undefined;
  const model = typeof query.model === "string" ? query.model : undefined;
  const data = await repository(repositoryId, model, provider);
  if (!data) notFound();
  const snapshot = data.repo.snapshot ?? {};
  const filterQuery = new URLSearchParams();
  if (provider) filterQuery.set("provider", provider);
  if (model) filterQuery.set("model", model);

  return <Page>
    <BackLink href="/">← All repositories</BackLink>
    <Toolbar>
      <Box sx={{ mt: 3 }}>
        <Eyebrow>Repository architecture</Eyebrow>
        <Typography variant="h1">Structure · {data.repo.name}</Typography>
        <Intro>Current repository shape and structural change over time.</Intro>
      </Box>
      <AnalysisFilters
        idPrefix="structure"
        initialProvider={provider}
        initialModel={model}
        providers={data.providers.map((item: any) => ({ value: item.provider, label: item.provider }))}
        models={data.models.map((item: any) => ({ value: item.model, label: item.model }))}
        modelLabel="Model"
      />
    </Toolbar>
    <RepositoryNav repositoryId={repositoryId} queryString={filterQuery.toString()} />
    <SectionTitle>Current structure</SectionTitle>
    <Cards compact>
      <StatCard label="File LOC median / p95 / max" value={`${compact(snapshot.median_file_loc)} / ${compact(snapshot.p95_file_loc)} / ${compact(snapshot.max_file_loc)}`} />
      <StatCard label="Large files >500 / >1k / >2k" value={`${snapshot.files_over_500_loc ?? 0} / ${snapshot.files_over_1000_loc ?? 0} / ${snapshot.files_over_2000_loc ?? 0}`} />
      <StatCard label="Directory depth p95 / max" value={`${Number(snapshot.p95_directory_depth ?? 0).toFixed(1)} / ${snapshot.max_directory_depth ?? 0}`} />
      <StatCard label="Tests / source ratio" value={`${snapshot.test_file_count ?? 0} / ${(Number(snapshot.test_to_source_ratio ?? 0) * 100).toFixed(1)}%`} />
      <StatCard label="CLAUDE.md files / bytes" value={`${snapshot.claude_md_count ?? 0} / ${compact(snapshot.claude_md_total_bytes)}`} />
      <StatCard label="AGENTS.md files / bytes" value={`${snapshot.agents_md_count ?? 0} / ${compact(snapshot.agents_md_total_bytes)}`} />
      <StatCard label="Fan-out p95 / cycles" value={`${Number(snapshot.p95_fan_out ?? 0).toFixed(1)} / ${snapshot.dependency_cycle_count ?? 0}`} />
      <StatCard label="Cross-module edge ratio" value={`${(Number(snapshot.cross_module_edge_ratio ?? 0) * 100).toFixed(1)}%`} />
      <StatCard label="Languages" value={Object.entries(snapshot.language_distribution_json ?? {}).map(([language, value]: any) => `${language} ${compact(value.loc)}`).join(", ") || "—"} />
    </Cards>
    <RepositoryStructureTimeline snapshots={data.snapshots} commits={data.commits} />
  </Page>;
}
