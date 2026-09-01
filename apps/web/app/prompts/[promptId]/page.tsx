import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { median } from "@tokenlens/analytics";
import { notFound } from "next/navigation";
import { FileReadsDataTable } from "../../../components/data-tables";
import { CreateBenchmarkButton } from "../../../components/create-benchmark-button";
import { BackLink, Cards, EmptyState, Eyebrow, Intro, MetricCard, Page, Panel, SectionTitle } from "../../../components/ui";
import { promptDetail } from "../../../lib/data";
import { compact, money, duration, date } from "../../../lib/format";
import { canonicalToolActions } from "../../../lib/tool-events";

export const dynamic = "force-dynamic";

export default async function Prompt({ params }: any) {
  const data = await promptDetail((await params).promptId);
  if (!data) notFound();
  const { prompt: p, api, tools } = data;
  const sum = (k: string) => api.reduce((n: number, x: any) => n + Number(x[k] ?? 0), 0);
  const fresh = sum("input_tokens"), cacheRead = sum("cache_read_tokens"), cacheCreate = sum("cache_creation_tokens"), output = sum("output_tokens");
  const context = fresh + cacheRead + cacheCreate;
  const cacheMetricsAvailable = api.length > 0 && api.every((x: any) => x.cache_metrics_available);
  const actions = canonicalToolActions(tools);
  const reads = actions.flatMap((action) => action.rows).filter((row) => row.file_access_kind === "read")
    .filter((x): x is typeof x & { relative_file_path: string } => Boolean(x.relative_file_path));
  const editActions = actions.filter((action) => action.category === "edit");
  const edits = actions.flatMap((action) => action.rows).filter((row) => row.file_access_kind === "edit")
    .filter((x): x is typeof x & { relative_file_path: string } => Boolean(x.relative_file_path));
  const group = new Map<string, any>();
  for (const r of reads) { const g = group.get(r.relative_file_path) ?? { ...r, reads: 0 }; g.reads++; group.set(r.relative_file_path, g); }
  const files = [...group.values()];
  const modules = new Set(files.map((x) => x.module_name).filter(Boolean));
  const locs = files.map((x) => Number(x.loc ?? 0));
  const firstEditAction = editActions.find((action) => action.timestamp);
  const firstEdit = firstEditAction?.timestamp ? +new Date(firstEditAction.timestamp) - +new Date(p.started_at) : null;
  const knownOutcomes = actions.filter((action) => action.success != null);
  const knownDurations = actions.map((action) => action.durationMs).filter((value): value is number => value != null);
  const editedFiles = new Set(edits.map((x) => x.relative_file_path));
  const hasReadAttribution = reads.length > 0;
  const toolTypes = new Set(actions.map((action) => action.category));
  const timeline = [
    { kind: "Prompt", timestamp: p.started_at },
    ...api.map((x: any) => ({ kind: `Model response · ${x.model ?? "model"}`, timestamp: x.timestamp })),
    ...actions.map((action) => {
      const paths = [...new Set(action.rows.map((row) => row.relative_file_path).filter(Boolean))];
      return { kind: paths.length ? `${action.toolName} · ${paths.join(", ")}` : action.toolName, timestamp: action.timestamp };
    }),
  ].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
  const costs = api.map((x: any) => x.cost_usd).filter((x: any) => x != null);
  const promptModels = [...new Set(api.map((x: any) => x.model ?? p.model).filter(Boolean))] as string[];
  const cards = (items: [string, string][]) => <Cards>{items.map(([label, value]) => <MetricCard key={label} label={label} value={value} />)}</Cards>;

  return <Page>
    <BackLink href={`/repos/${p.repository_id}/prompts`}>← Prompts</BackLink>
    <Eyebrow sx={{ mt: 3 }}>{p.repository_name} · {date(p.started_at)} · {p.provider}</Eyebrow>
    <Typography variant="h1">{p.prompt_text ? p.prompt_text.slice(0, 100) : `Prompt #${p.external_prompt_id.slice(0, 10)}`}</Typography>
    <Intro>{p.email ?? "Identity pending"} · Prompt length {compact(p.prompt_length)} characters · No tool contents are stored.</Intro>
    {p.repository_id && p.prompt_text && promptModels.length === 1
      ? <CreateBenchmarkButton repositoryId={p.repository_id} promptId={p.id} model={promptModels[0]} />
      : <Typography color="text.secondary" sx={{ mt: 2 }} variant="body2">
          {!p.prompt_text
            ? "Legacy prompts without captured text cannot be benchmarked."
            : promptModels.length > 1
              ? "This prompt used multiple models, so its aggregate measurements cannot form a single-model benchmark."
              : "Benchmarking will be available when model telemetry arrives."}
        </Typography>}
    <SectionTitle>Usage</SectionTitle>{cards([
      ["Fresh input", cacheMetricsAvailable ? compact(fresh) : "—"], ["Cache read", cacheMetricsAvailable ? compact(cacheRead) : "—"], ["Cache creation", cacheMetricsAvailable ? compact(cacheCreate) : "—"], ["Output", compact(output)],
      ["Context processed", compact(context)], ["Cost", money(costs.length ? costs.reduce((n: number, x: any) => n + Number(x), 0) : null)], ["Model responses", String(api.length)],
    ])}
    <SectionTitle>Agent behaviour</SectionTitle>{cards([
      ["Tool calls", String(actions.length)],
      ["Successful", knownOutcomes.length ? String(knownOutcomes.filter((action) => action.success).length) : "—"],
      ["Failed", knownOutcomes.length ? String(knownOutcomes.filter((action) => !action.success).length) : "—"],
      ["Shell calls", String(actions.filter((action) => action.category === "shell").length)],
      ["Tool types", String(toolTypes.size)],
      ["Tool time", duration(knownDurations.length ? knownDurations.reduce((sum, value) => sum + value, 0) : null)],
      ["Observed files read", hasReadAttribution ? String(files.length) : "—"],
      ["Repeated observed reads", hasReadAttribution ? String(reads.length - files.length) : "—"],
      ["Observed files edited", editActions.length ? (editedFiles.size ? String(editedFiles.size) : "—") : "0"],
      ["Modules visited", hasReadAttribution ? String(modules.size) : "—"],
      ["Time to first edit", duration(firstEdit)],
    ])}
    <SectionTitle>Working set</SectionTitle>{files.length ? cards([
      ["Working-set LOC", compact(locs.reduce((a, b) => a + b, 0))], ["Mean file LOC", compact(locs.length ? locs.reduce((a, b) => a + b, 0) / locs.length : 0)],
      ["Median file LOC", compact(median(locs))], ["Largest file", compact(Math.max(0, ...locs))],
      ["Mean fan-out", (files.length ? files.reduce((n, x) => n + Number(x.dependency_fan_out ?? 0), 0) / files.length : 0).toFixed(1)],
      ["Files in cycles", String(files.filter((x) => x.in_dependency_cycle).length)],
    ]) : <Panel><EmptyState>No attributable file reads were observed. Shell reads are included only when a concrete repository file can be identified locally.</EmptyState></Panel>}
    {files.length ? <FileReadsDataTable rows={files.map((f: any) => ({
      id: String(f.relative_file_path),
      file: String(f.relative_file_path),
      loc: Number(f.loc ?? 0),
      reads: Number(f.reads ?? 0),
      fanOut: f.dependency_fan_out == null ? null : Number(f.dependency_fan_out),
      module: String(f.module_name ?? "Unmatched snapshot"),
    }))} /> : <Panel sx={{ p: 0 }}><EmptyState>No file reads were attributed to this prompt.</EmptyState></Panel>}
    <SectionTitle>Timeline</SectionTitle><Panel sx={{ p: 0 }}><List disablePadding>{timeline.map((e, i) => <ListItem key={i} sx={{ alignItems: "flex-start", borderLeft: 2, borderColor: "divider", ml: 2, pl: 3, py: 1.5 }}>
      <Box sx={{ position: "absolute", width: 10, height: 10, bgcolor: "primary.main", borderRadius: "50%", left: -6, top: 20 }} />
      <ListItemText primary={e.kind} secondary={date(e.timestamp)} slotProps={{ primary: { sx: { fontWeight: 700 } }, secondary: { sx: { fontSize: 12 } } }} />
    </ListItem>)}</List></Panel>
  </Page>;
}
