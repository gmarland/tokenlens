import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Link from "./link";
import { EmptyState, Panel } from "./ui";
import { compact, date } from "../lib/format";

export type PromptBenchmarkSummary = {
  id: string;
  name: string;
  provider: string;
  model: string;
  runs: number;
  lastSeenAt: string | null;
  medianContext: number | null;
  regression: boolean;
};

export function PromptBenchmarks({ benchmarks }: { benchmarks: PromptBenchmarkSummary[] }) {
  return benchmarks.length ? (
    <Box sx={{ display: "grid", gap: 2, mt: 2 }}>
      {benchmarks.map((benchmark) => (
        <Card key={benchmark.id} variant="outlined">
          <CardContent
            sx={{
              display: "flex",
              gap: 2,
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Box>
              <MuiLink component={Link} href={`/benchmarks/${benchmark.id}`} color="inherit" underline="hover">
                <Typography variant="h3">{benchmark.name}</Typography>
              </MuiLink>
              <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
                <Chip label={benchmark.provider} size="small" />
                <Chip label={benchmark.model} size="small" />
                {benchmark.regression ? <Chip color="warning" label="Regression" size="small" /> : null}
              </Box>
            </Box>
            <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
              <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{benchmark.runs} runs</Typography>
              <Typography color="text.secondary" variant="body2">
                {benchmark.lastSeenAt ? `Last seen ${date(benchmark.lastSeenAt)}` : "Not observed"}
                {benchmark.medianContext != null ? ` · median ${compact(benchmark.medianContext)} context` : ""}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  ) : (
    <Panel>
      <EmptyState>Create a benchmark from the detail page of a prompt with captured text and model telemetry.</EmptyState>
    </Panel>
  );
}
