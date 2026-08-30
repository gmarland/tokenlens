import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { spearman, relationship } from "@tokenlens/analytics";
import { ScatterPlot } from "../components/charts";
import { AnalysisFilters } from "../components/filters";
import Link from "../components/link";
import {
  Cards, EmptyState, Eyebrow, Intro, Label, MetricCard, Page, Panel,
  ResponsiveTable, SectionTitle, Toolbar, numericCellSx,
} from "../components/ui";
import { overview } from "../lib/data";
import { compact } from "../lib/format";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: {
  searchParams: Promise<{ model?: string; provider?: string }>;
}) {
  const q = await searchParams;
  const initial = await overview(q.model, q.provider);
  const total = initial.models.reduce((n: number, x: any) => n + x.count, 0);
  const dominant = initial.models[0] && initial.models[0].count / total >= 0.8
    ? initial.models[0].model
    : undefined;
  const selected = q.model ?? dominant;
  const data = selected && !q.model ? await overview(selected, q.provider) : initial;
  const { summary: s, repositories, models, providers } = data;
  const qualified = repositories.filter((r: any) => r.prompts >= 10 && r.loc);
  const rho = qualified.length >= 5
    ? spearman(
        qualified.map((r: any) => Number(r.loc)),
        qualified.map((r: any) => Number(r.median_context)),
      )
    : null;
  const query = new URLSearchParams();
  if (selected) query.set("model", selected);
  if (q.provider) query.set("provider", q.provider);

  return (
    <Page>
      <Toolbar>
        <Box>
          <Eyebrow>Codebase efficiency profiler</Eyebrow>
          <Typography variant="h1" sx={{ mt: 0.75 }}>Repository context, made visible.</Typography>
          <Intro>
            Measure how coding agents explore your repositories and discover descriptive
            relationships between code structure and context consumption.
          </Intro>
        </Box>
      </Toolbar>

      <Cards>
        <MetricCard label="Repositories" value={compact(s.repositories)} />
        <MetricCard label="Developers" value={compact(s.developers)} />
        <MetricCard label="Prompts observed" value={compact(s.prompts)} />
        <MetricCard label="Context tokens processed" value={compact(s.context_tokens)} />
      </Cards>

      <Toolbar>
        <SectionTitle>Repositories</SectionTitle>
        <AnalysisFilters
          key={`${q.provider ?? ""}:${selected ?? ""}`}
          idPrefix="overview"
          initialProvider={q.provider}
          initialModel={selected}
          providers={providers.map((p: any) => ({
            value: p.provider,
            label: p.provider === "codex" ? "Codex" : "Claude Code",
          }))}
          models={models.map((m: any) => ({ value: m.model, label: m.model }))}
          modelLabel="Analysis model"
          modelPlaceholder="Choose analysis model"
        />
      </Toolbar>

      <ResponsiveTable>
        {repositories.length ? (
          <Table>
            <TableHead><TableRow>
              <TableCell>Repository</TableCell>
              <TableCell sx={numericCellSx}>Source files</TableCell>
              <TableCell sx={numericCellSx}>LOC</TableCell>
              <TableCell sx={numericCellSx}>Prompts</TableCell>
              <TableCell sx={numericCellSx}>Median context</TableCell>
              <TableCell sx={numericCellSx}>Files read</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {repositories.map((r: any) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <MuiLink component={Link} href={`/repos/${r.id}${query.size ? `?${query}` : ""}`} color="inherit" underline="hover" sx={{ fontWeight: 650 }}>{r.name}</MuiLink>
                  </TableCell>
                  <TableCell sx={numericCellSx}>{compact(r.source_files)}</TableCell>
                  <TableCell sx={numericCellSx}>{compact(r.loc)}</TableCell>
                  <TableCell sx={numericCellSx}>{r.prompts}</TableCell>
                  <TableCell sx={numericCellSx}>{compact(r.median_context)}</TableCell>
                  <TableCell sx={numericCellSx}>{Number(r.median_files).toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState>No telemetry yet. Install the profiler to begin collecting repository data.</EmptyState>
        )}
      </ResponsiveTable>

      <SectionTitle>Repository LOC vs median context</SectionTitle>
      <Panel>
        <ScatterPlot data={repositories.map((r: any) => ({ loc: Number(r.loc), context: Number(r.median_context) }))} x="loc" y="context" />
        {rho !== null ? (
          <Typography sx={{ mt: 1 }}><Box component="strong">ρ = {rho.toFixed(2)}</Box> · n = {qualified.length} repositories · {relationship(rho)} for <Box component="strong">{selected}</Box>.</Typography>
        ) : (
          <Label>Raw observations for {selected ?? "the selected model"} are shown. A cross-repository correlation requires at least 5 repositories with 10 prompts each.</Label>
        )}
      </Panel>

      <Alert id="methodology" severity="warning" variant="outlined" sx={{ mt: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Methodological limitation</Typography>
        <Typography>Token usage is affected by task complexity, developer behaviour, model selection, session history, tools, provider, and repository structure. Correlations shown here identify observed relationships, not causation.</Typography>
      </Alert>
    </Page>
  );
}
