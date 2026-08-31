import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { correlations, median, relationship } from "@tokenlens/analytics";
import { notFound } from "next/navigation";
import { Trend } from "../../../components/charts";
import { AnalysisFilters } from "../../../components/filters";
import { BackLink, Cards, EmptyState, Eyebrow, Intro, Label, MetricCard, Page, Panel, SectionTitle, StatCard, Toolbar } from "../../../components/ui";
import { repository } from "../../../lib/data";
import { compact, duration } from "../../../lib/format";

export const dynamic = "force-dynamic";

export default async function Repo({ params, searchParams }: any) {
  const id = (await params).repositoryId;
  const q = await searchParams;
  const data = await repository(id, q.model, q.provider);
  if (!data) notFound();
  const rs = data.prompts;
  const s = data.repo.snapshot ?? {};
  const scope = `${q.provider ?? "all providers"} · ${q.model ?? "all models"}`;
  const nums = (k: string) => rs.map((x: any) => Number(x[k] ?? 0));
  const corr = correlations(rs, (x: any) => Number(x.context_tokens), {
    "Working-set LOC": (x) => Number(x.working_loc), "Largest file read": (x) => Number(x.max_file_loc),
    "Files read": (x) => Number(x.files_read), "Repeated reads": (x) => Number(x.repeated_reads),
    "Module count": (x) => Number(x.modules), "Dependency fan-out": (x) => Number(x.mean_fan_out),
    "Tool-result size": (x) => Number(x.tool_bytes),
  });
  const promptQuery = new URLSearchParams();
  if (q.model) promptQuery.set("model", q.model);
  if (q.provider) promptQuery.set("provider", q.provider);

  return <Page>
    <BackLink href="/">← All repositories</BackLink>
    <Toolbar>
      <Box sx={{ mt: 3 }}><Eyebrow>Repository</Eyebrow><Typography variant="h1">{data.repo.name}</Typography>
        <Intro>Observed structure and coding-agent behaviour. Analysis scope: <Box component="strong">{scope}</Box></Intro>
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
        models={data.models.map((model: any) => ({ value: model.model, label: model.model }))}
        modelLabel="Model"
      />
    </Toolbar>
    <Cards>
      <MetricCard label="Source LOC" value={compact(s.total_source_loc)} /><MetricCard label="Source files" value={compact(s.source_files)} />
      <MetricCard label="Packages" value={compact(s.package_count)} /><MetricCard label="Prompts" value={compact(rs.length)} />
      <MetricCard label="Median context / prompt" value={compact(median(nums("context_tokens")))} />
      <MetricCard label="Median files read" value={median(nums("files_read")).toFixed(1)} />
      <MetricCard label="Median time to first edit" value={duration(median(rs.filter((x: any) => x.first_edit).map((x: any) => +new Date(x.first_edit) - +new Date(x.started_at))))} />
    </Cards>
    <Toolbar><SectionTitle>Agent behaviour</SectionTitle><BackLink href={`/repos/${id}/prompts${promptQuery.size ? `?${promptQuery}` : ""}`}>Explore prompts →</BackLink></Toolbar>
    <Panel><Trend data={rs.map((x: any) => ({ date: new Date(x.started_at).toLocaleDateString(), context: Number(x.context_tokens), files: Number(x.files_read) }))} keys={["context", "files"]} /></Panel>
    <SectionTitle>Repository structure</SectionTitle>
    <Cards compact>
      <StatCard label="File LOC median / p95 / max" value={`${compact(s.median_file_loc)} / ${compact(s.p95_file_loc)} / ${compact(s.max_file_loc)}`} />
      <StatCard label="Large files >500 / >1k / >2k" value={`${s.files_over_500_loc ?? 0} / ${s.files_over_1000_loc ?? 0} / ${s.files_over_2000_loc ?? 0}`} />
      <StatCard label="Directory depth p95 / max" value={`${Number(s.p95_directory_depth ?? 0).toFixed(1)} / ${s.max_directory_depth ?? 0}`} />
      <StatCard label="Tests / source ratio" value={`${s.test_file_count ?? 0} / ${(Number(s.test_to_source_ratio ?? 0) * 100).toFixed(1)}%`} />
      <StatCard label="CLAUDE.md files / bytes" value={`${s.claude_md_count ?? 0} / ${compact(s.claude_md_total_bytes)}`} />
      <StatCard label="AGENTS.md files / bytes" value={`${s.agents_md_count ?? 0} / ${compact(s.agents_md_total_bytes)}`} />
      <StatCard label="Fan-out p95 / cycles" value={`${Number(s.p95_fan_out ?? 0).toFixed(1)} / ${s.dependency_cycle_count ?? 0}`} />
      <StatCard label="Cross-module edge ratio" value={`${(Number(s.cross_module_edge_ratio ?? 0) * 100).toFixed(1)}%`} />
      <StatCard label="Languages" value={Object.entries(s.language_distribution_json ?? {}).map(([k, v]: any) => `${k} ${compact(v.loc)}`).join(", ") || "—"} />
    </Cards>
    <SectionTitle>Observed relationships</SectionTitle>
    {corr.length ? <Cards compact>{corr.map((c) => <Card variant="outlined" key={c.name}><CardContent>
      <Label>{c.name} ↔ context processed</Label><Typography sx={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.04em", color: "info.main" }}>ρ = {c.rho!.toFixed(2)}</Typography>
      <Typography>{relationship(c.rho!)}</Typography><Label>n = {c.n} prompts · descriptive, not causal</Label>
    </CardContent></Card>)}</Cards> : <Panel><EmptyState>At least 20 prompts matching the current filters are required before correlations are displayed.</EmptyState></Panel>}
  </Page>;
}
