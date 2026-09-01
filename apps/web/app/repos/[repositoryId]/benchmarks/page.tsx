import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { BackLink, EmptyState, Eyebrow, Page, Panel } from "../../../../components/ui";
import Link from "../../../../components/link";
import { repositoryBenchmarks } from "../../../../lib/data";
import { benchmarkInsight } from "../../../../lib/insights";
import { compact, date } from "../../../../lib/format";

export const dynamic = "force-dynamic";

export default async function Benchmarks({ params }: { params: Promise<{ repositoryId: string }> }) {
  const repositoryId = (await params).repositoryId;
  const benchmarks = await repositoryBenchmarks(repositoryId);
  const health = new Map((await Promise.all(benchmarks.map(async (benchmark: any) => {
    const result = await benchmarkInsight(String(benchmark.id));
    return [String(benchmark.id), Boolean(result?.insights.length)] as const;
  }))));

  return <Page>
    <BackLink href={`/repos/${repositoryId}`}>← Repository</BackLink>
    <Eyebrow sx={{ mt: 3 }}>Repeatable observations</Eyebrow>
    <Typography variant="h1">Prompt benchmarks</Typography>
    <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 760 }}>
      Exact prompt and model matches are tracked across repository revisions. These charts measure usage and agent behaviour; assistant response contents are not collected.
    </Typography>
    {benchmarks.length ? <Box sx={{ display: "grid", gap: 2, mt: 5 }}>
      {benchmarks.map((benchmark: any) => <Card key={benchmark.id} variant="outlined">
        <CardContent sx={{ display: "flex", gap: 2, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <Box>
            <MuiLink component={Link} href={`/benchmarks/${benchmark.id}`} color="inherit" underline="hover">
              <Typography variant="h3">{benchmark.name}</Typography>
            </MuiLink>
            <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
              <Chip label={benchmark.provider} size="small" />
              <Chip label={benchmark.model} size="small" />
              {health.get(String(benchmark.id)) ? <Chip color="warning" label="Regression" size="small" /> : null}
            </Box>
          </Box>
          <Box sx={{ textAlign: "right" }}>
            <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{benchmark.runs} runs</Typography>
            <Typography color="text.secondary" variant="body2">
              {benchmark.last_seen_at ? `Last seen ${date(benchmark.last_seen_at)}` : "Not observed"}
              {benchmark.median_context != null ? ` · median ${compact(benchmark.median_context)} context` : ""}
            </Typography>
          </Box>
        </CardContent>
      </Card>)}
    </Box> : <Panel><EmptyState>Create a benchmark from the detail page of a prompt with captured text and model telemetry.</EmptyState></Panel>}
  </Page>;
}
