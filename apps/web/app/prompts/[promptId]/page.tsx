import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { median } from "@tokenlens/analytics";
import { notFound } from "next/navigation";
import { BackLink, Cards, EmptyState, Eyebrow, Intro, MetricCard, Page, Panel, ResponsiveTable, SectionTitle, numericCellSx } from "../../../components/ui";
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
  const cards = (items: [string, string][]) => <Cards>{items.map(([label, value]) => <MetricCard key={label} label={label} value={value} />)}</Cards>;

  return <Page>
    <BackLink href={`/repos/${p.repository_id}/prompts`}>← Prompts</BackLink>
    <Eyebrow sx={{ mt: 3 }}>{p.repository_name} · {date(p.started_at)} · {p.provider}</Eyebrow>
    <Typography variant="h1">{p.prompt_text ? p.prompt_text.slice(0, 100) : `Prompt #${p.external_prompt_id.slice(0, 10)}`}</Typography>
    <Intro>{p.email ?? "Identity pending"} · Prompt length {compact(p.prompt_length)} characters · No tool contents are stored.</Intro>
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
    <ResponsiveTable>{files.length ? <Table><TableHead><TableRow>
      <TableCell>File</TableCell>{["LOC", "Reads", "Fan-out"].map((x) => <TableCell key={x} sx={numericCellSx}>{x}</TableCell>)}<TableCell>Module</TableCell>
    </TableRow></TableHead><TableBody>{files.sort((a, b) => b.reads - a.reads).map((f: any) => <TableRow key={f.relative_file_path} hover>
      <TableCell sx={{ fontWeight: 650 }}>{f.relative_file_path}</TableCell><TableCell sx={numericCellSx}>{compact(f.loc)}</TableCell>
      <TableCell sx={numericCellSx}>{f.reads}</TableCell><TableCell sx={numericCellSx}>{f.dependency_fan_out ?? "—"}</TableCell><TableCell>{f.module_name ?? "Unmatched snapshot"}</TableCell>
    </TableRow>)}</TableBody></Table> : <EmptyState>No file reads were attributed to this prompt.</EmptyState>}</ResponsiveTable>
    <SectionTitle>Timeline</SectionTitle><Panel sx={{ p: 0 }}><List disablePadding>{timeline.map((e, i) => <ListItem key={i} sx={{ alignItems: "flex-start", borderLeft: 2, borderColor: "divider", ml: 2, pl: 3, py: 1.5 }}>
      <Box sx={{ position: "absolute", width: 10, height: 10, bgcolor: "primary.main", borderRadius: "50%", left: -6, top: 20 }} />
      <ListItemText primary={e.kind} secondary={date(e.timestamp)} slotProps={{ primary: { sx: { fontWeight: 700 } }, secondary: { sx: { fontSize: 12 } } }} />
    </ListItem>)}</List></Panel>
  </Page>;
}
