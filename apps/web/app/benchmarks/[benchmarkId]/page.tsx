import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { median } from "@tokenlens/analytics";
import { notFound } from "next/navigation";
import { BenchmarkTrend, type BenchmarkPoint } from "../../../components/benchmark-trend";
import Link from "../../../components/link";
import { BackLink, Cards, EmptyState, Eyebrow, MetricCard, Page, Panel, SectionTitle } from "../../../components/ui";
import { benchmarkDetail } from "../../../lib/data";
import { compact, date, duration, money } from "../../../lib/format";

export const dynamic = "force-dynamic";

export default async function BenchmarkPage({ params }: { params: Promise<{ benchmarkId: string }> }) {
  const data = await benchmarkDetail((await params).benchmarkId);
  if (!data) notFound();
  const benchmark = data.benchmark;
  const points = data.points as BenchmarkPoint[];
  const complete = points.filter((point) => !point.provisional);
  const sample = complete.length ? complete : points;
  const values = (key: keyof BenchmarkPoint) => sample
    .map((point) => point[key])
    .filter((value): value is number => typeof value === "number");
  const costs = values("costUsd");
  const baseline = complete.length >= 5 ? median(complete.slice(0, 5).map((point) => point.contextTokens)) : null;
  const latestContext = complete.at(-1)?.contextTokens;
  const contextChange = baseline && latestContext != null ? ((latestContext - baseline) / baseline) * 100 : null;

  return <Page>
    <BackLink href={`/repos/${benchmark.repository_id}/benchmarks`}>← Benchmarks</BackLink>
    <Eyebrow sx={{ mt: 3 }}>{benchmark.repository_name}</Eyebrow>
    <Typography variant="h1">{benchmark.name}</Typography>
    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
      <Chip label={benchmark.provider} size="small" />
      <Chip label={benchmark.model} size="small" />
    </Stack>
    <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 800, whiteSpace: "pre-wrap" }}>
      {benchmark.prompt_text}
    </Typography>
    <Cards>
      <MetricCard label="Observations" value={compact(points.length)} />
      <MetricCard label="Median context" value={compact(median(values("contextTokens")))} />
      <MetricCard label="Median output" value={compact(median(values("outputTokens")))} />
      <MetricCard label="Median response time" value={duration(median(values("responseDurationMs")))} />
      <MetricCard label="Median cost" value={money(costs.length ? median(costs) : null)} />
      <MetricCard label="Median files read" value={median(values("filesRead")).toFixed(1)} />
      <MetricCard label="Latest context vs baseline" value={contextChange == null ? "—" : `${contextChange >= 0 ? "+" : ""}${contextChange.toFixed(1)}%`} />
    </Cards>
    <SectionTitle>Performance over time</SectionTitle>
    {points.length ? <Panel><BenchmarkTrend points={points} /></Panel> : <Panel><EmptyState>This exact prompt and model combination has not been observed.</EmptyState></Panel>}
    {points.length ? <>
      <SectionTitle>Observations</SectionTitle>
      <Panel sx={{ p: 0 }}>
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
          {[...points].reverse().map((point) => <Box key={point.id} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(220px,1fr) repeat(3,auto)" }, gap: 2, alignItems: "center", px: 3, py: 2 }}>
            <MuiLink component={Link} href={`/prompts/${point.id}`} color="inherit" underline="hover" sx={{ fontWeight: 700 }}>
              {date(point.startedAt)}
            </MuiLink>
            <Typography variant="body2">{compact(point.contextTokens)} context</Typography>
            <Typography variant="body2">{point.filesRead} files read</Typography>
            {point.provisional ? <Chip color="warning" label="Provisional" size="small" /> : <Chip label="Complete" size="small" />}
          </Box>)}
        </Stack>
      </Panel>
    </> : null}
  </Page>;
}
