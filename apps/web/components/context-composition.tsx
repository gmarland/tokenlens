import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PromptFact } from "@tokenlens/shared";
import { compact } from "../lib/format";

export function ContextComposition({ facts }: { facts: PromptFact[] }) {
  const eligible = facts.filter((fact) => !fact.provisional && fact.hasUsage && fact.cacheMetricsAvailable);
  const fresh = eligible.reduce((sum, fact) => sum + fact.freshInputTokens, 0);
  const read = eligible.reduce((sum, fact) => sum + fact.cacheReadTokens, 0);
  const create = eligible.reduce((sum, fact) => sum + fact.cacheCreationTokens, 0);
  const total = fresh + read + create;
  if (!total) return <Typography color="text.secondary">Cache composition is unavailable for the current scope.</Typography>;
  const segments = [
    { label: "Fresh input", value: fresh, color: "primary.main" },
    { label: "Cache read", value: read, color: "info.main" },
    { label: "Cache creation", value: create, color: "warning.main" },
  ];
  return <Box>
    <Stack direction="row" sx={{ height: 18, overflow: "hidden", borderRadius: 1 }}>
      {segments.map((segment) => <Box key={segment.label} sx={{ width: `${(segment.value / total) * 100}%`, bgcolor: segment.color }} />)}
    </Stack>
    <Stack direction="row" sx={{ gap: 3, flexWrap: "wrap", mt: 1.5 }}>
      {segments.map((segment) => <Typography key={segment.label} variant="body2">
        <Box component="span" sx={{ fontWeight: 800 }}>{segment.label}</Box> {((segment.value / total) * 100).toFixed(1)}% · {compact(segment.value)}
      </Typography>)}
    </Stack>
    <Typography variant="caption" color="text.secondary">{eligible.length} complete prompts with cache telemetry.</Typography>
  </Box>;
}
