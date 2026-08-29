import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MuiLink from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { spearman, relationship } from "@tokenlens/analytics";
import { ScatterPlot } from "../components/charts";
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
  const initial = await overview(q.model, q.provider).catch(() => ({
    summary: {}, repositories: [], models: [], providers: [],
  }));
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
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <Chip label="Synthetic demo data" size="small" sx={{ bgcolor: "#d8f29b", color: "#27451c" }} />
        )}
      </Toolbar>

      <Cards>
        <MetricCard label="Repositories" value={compact(s.repositories)} />
        <MetricCard label="Developers" value={compact(s.developers)} />
        <MetricCard label="Prompts observed" value={compact(s.prompts)} />
        <MetricCard label="Context tokens processed" value={compact(s.context_tokens)} />
      </Cards>

      <Toolbar>
        <SectionTitle>Repositories</SectionTitle>
        <Stack component="form" direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
          <FormControl size="small" sx={{ minWidth: 145 }}>
            <InputLabel id="provider-label">Provider</InputLabel>
            <Select labelId="provider-label" label="Provider" name="provider" defaultValue={q.provider ?? ""}>
              <MenuItem value="">All providers</MenuItem>
              {providers.map((p: any) => (
                <MenuItem value={p.provider} key={p.provider}>{p.provider === "codex" ? "Codex" : "Claude Code"}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 210 }}>
            <InputLabel id="model-label">Analysis model</InputLabel>
            <Select labelId="model-label" label="Analysis model" name="model" defaultValue={selected ?? ""}>
              <MenuItem value="">Choose analysis model</MenuItem>
              {models.map((m: any) => <MenuItem value={m.model} key={m.model}>{m.model}</MenuItem>)}
            </Select>
          </FormControl>
          <Button type="submit" variant="contained">Apply</Button>
        </Stack>
      </Toolbar>

      <ResponsiveTable>
        {repositories.length ? (
          <Table>
            <TableHead><TableRow>
              <TableCell>Repository</TableCell>
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
                  <TableCell sx={numericCellSx}>{compact(r.loc)}</TableCell>
                  <TableCell sx={numericCellSx}>{r.prompts}</TableCell>
                  <TableCell sx={numericCellSx}>{compact(r.median_context)}</TableCell>
                  <TableCell sx={numericCellSx}>{Number(r.median_files).toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState>No telemetry yet. Run <Typography component="code" sx={{ fontFamily: "monospace" }}>pnpm demo:seed</Typography> or install the profiler.</EmptyState>
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

      <Alert id="methodology" severity="warning" variant="outlined" sx={{ mt: 2, bgcolor: "#fff9ee" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Methodological limitation</Typography>
        <Typography>Token usage is affected by task complexity, developer behaviour, model selection, session history, tools, provider, and repository structure. Correlations shown here identify observed relationships, not causation.</Typography>
      </Alert>
    </Page>
  );
}
