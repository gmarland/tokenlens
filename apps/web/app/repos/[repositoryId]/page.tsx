import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { median } from "@tokenlens/analytics";
import { notFound } from "next/navigation";
import { AnalysisFilters } from "../../../components/filters";
import { InsightCards } from "../../../components/insight-cards";
import { ContextComposition } from "../../../components/context-composition";
import { RepositoryNav } from "../../../components/repository-nav";
import {
  BackLink,
  Cards,
  Eyebrow,
  Intro,
  MetricCard,
  Page,
  Panel,
  SectionTitle,
  Toolbar,
} from "../../../components/ui";
import { repository } from "../../../lib/data";
import { repositoryInsightBundle } from "../../../lib/insights";
import { compact, duration } from "../../../lib/format";

export const dynamic = "force-dynamic";

export default async function Repo({ params, searchParams }: any) {
  const id = (await params).repositoryId;
  const q = await searchParams;
  const [data, insightBundle] = await Promise.all([
    repository(id, q.model, q.provider),
    repositoryInsightBundle(id, { model: q.model, provider: q.provider }),
  ]);
  if (!data) notFound();
  const rs = data.prompts;
  const s = data.repo.snapshot ?? {};
  const latestStructure = data.snapshots.at(-1);
  const scope = `${q.provider ?? "all providers"} · ${q.model ?? "all models"}`;
  const nums = (k: string) => rs.map((x: any) => Number(x[k] ?? 0));
  const promptQuery = new URLSearchParams();
  if (q.model) promptQuery.set("model", q.model);
  if (q.provider) promptQuery.set("provider", q.provider);

  return (
    <Page>
      <BackLink href="/">← All repositories</BackLink>
      <Toolbar>
        <Box sx={{ mt: 3 }}>
          <Eyebrow>Repository</Eyebrow>
          <Typography variant="h1">{data.repo.name}</Typography>
          <Intro>
            Observed structure and coding-agent behaviour. Analysis scope:{" "}
            <Box component="strong">{scope}</Box>
          </Intro>
        </Box>
        <AnalysisFilters
          key={`${q.provider ?? ""}:${q.model ?? ""}`}
          idPrefix="repository"
          initialProvider={q.provider}
          initialModel={q.model}
          providers={data.providers.map((provider: any) => ({
            value: provider.provider,
            label: provider.provider === "codex" ? "Codex" : "Claude Code",
          }))}
          models={data.models.map((model: any) => ({
            value: model.model,
            label: model.model,
          }))}
          modelLabel="Model"
        />
      </Toolbar>
      <RepositoryNav repositoryId={id} queryString={promptQuery.toString()} />
      <Cards>
        <MetricCard label="Source LOC" value={compact(s.total_source_loc)} />
        <MetricCard label="Source files" value={compact(s.source_files)} />
        <MetricCard label="Modules" value={compact(latestStructure?.modules)} />
        <MetricCard label="Packages" value={compact(s.package_count)} />
        <MetricCard label="Prompts" value={compact(rs.length)} />
        <MetricCard
          label="Median context / prompt"
          value={compact(median(nums("context_tokens")))}
        />
        <MetricCard
          label="Median files read"
          value={median(nums("files_read")).toFixed(1)}
        />
        <MetricCard
          label="Median time to first edit"
          value={duration(
            median(
              rs
                .filter((x: any) => x.first_edit)
                .map(
                  (x: any) => +new Date(x.first_edit) - +new Date(x.started_at),
                ),
            ),
          )}
        />
      </Cards>
      <SectionTitle>Recommended actions</SectionTitle>
      <Panel><InsightCards insights={insightBundle.insights.filter((insight) => !["dismissed", "resolved"].includes(insight.state ?? "new")).slice(0, 3)} /></Panel>
      <SectionTitle>Context composition</SectionTitle>
      <Panel><ContextComposition facts={insightBundle.facts} /></Panel>
    </Page>
  );
}
