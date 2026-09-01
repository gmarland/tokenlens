import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Insight } from "@tokenlens/shared";
import Link from "./link";
import { EmptyState } from "./ui";
import { compact, duration, money } from "../lib/format";
import { InsightStateActions } from "./insight-state-actions";

function evidenceValue(value: number | string, unit?: string) {
  if (typeof value !== "number") return value;
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "milliseconds") return duration(value);
  if (unit === "usd") return money(value);
  return compact(value);
}

export function InsightCards({ insights, empty = "No actionable insights meet the evidence thresholds yet." }: {
  insights: Insight[];
  empty?: string;
}) {
  if (!insights.length) return <EmptyState>{empty}</EmptyState>;
  return <Stack spacing={2}>
    {insights.map((insight) => <Alert
      key={insight.id}
      severity={insight.severity === "warning" ? "warning" : insight.severity === "opportunity" ? "info" : "success"}
      variant="outlined"
      sx={{ alignItems: "flex-start", "& .MuiAlert-message": { width: "100%" } }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{insight.title}</Typography>
            <Chip size="small" label={`${insight.confidence} confidence`} />
          </Stack>
          <Typography sx={{ mt: .5 }}>{insight.summary}</Typography>
        </Box>
        {insight.recommendation.href ? <Button component={Link} href={insight.recommendation.href} size="small" variant="outlined">Investigate</Button> : null}
      </Stack>
      <Typography sx={{ mt: 1.5, fontWeight: 700 }}>Recommended action</Typography>
      <Typography variant="body2">{insight.recommendation.text}</Typography>
      <Box
        sx={{ mt: 1.5, p: 1.5, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}
        aria-label={`Action example for ${insight.title}`}
      >
        <Typography variant="overline" color="text.secondary">Illustrative example</Typography>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{insight.recommendation.example.title}</Typography>
        <Box component="ol" sx={{ my: 1, pl: 2.5 }}>
          <Typography component="li" variant="body2">{insight.recommendation.example.steps[0]}</Typography>
        </Box>
        {insight.recommendation.example.steps.length > 1 || insight.recommendation.example.snippet ? <Box component="details">
          <Box component="summary" sx={{ cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Show complete example</Box>
          {insight.recommendation.example.steps.length > 1 ? <Box component="ol" start={2} sx={{ mt: 1, mb: 0, pl: 2.5 }}>
            {insight.recommendation.example.steps.slice(1).map((step) =>
              <Typography component="li" variant="body2" key={step} sx={{ mb: .5 }}>{step}</Typography>)}
          </Box> : null}
          {insight.recommendation.example.snippet ? <Box
            component="pre"
            aria-label={`${insight.recommendation.example.snippet.language} example`}
            sx={{ mt: 1, mb: 0, p: 1.5, overflowX: "auto", bgcolor: "grey.100", fontSize: 12, whiteSpace: "pre-wrap" }}
          >{insight.recommendation.example.snippet.content}</Box> : null}
        </Box> : null}
      </Box>
      <Box component="details" sx={{ mt: 1.5 }}>
        <Box component="summary" sx={{ cursor: "pointer", fontWeight: 700 }}>Evidence and methodology</Box>
        <Stack direction="row" sx={{ gap: 2, flexWrap: "wrap", mt: 1 }}>
          {insight.evidence.map((item) => <Box key={item.label}>
            <Typography variant="caption" color="text.secondary">{item.label}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {evidenceValue(item.value, item.unit)}
              {item.baseline != null ? ` · baseline ${evidenceValue(item.baseline, item.unit)}` : ""}
            </Typography>
          </Box>)}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          n = {insight.sampleSize}{insight.coverage == null ? "" : ` · ${(insight.coverage * 100).toFixed(0)}% coverage`}
          {insight.comparisonPeriod ? ` · ${insight.comparisonPeriod}` : ""}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}><strong>Validate:</strong> {insight.validation.text}</Typography>
        {insight.caveats.map((caveat) => <Typography key={caveat} variant="caption" color="text.secondary" sx={{ display: "block", mt: .5 }}>{caveat}</Typography>)}
      </Box>
      {insight.scope.repositoryId ? <InsightStateActions
        repositoryId={insight.scope.repositoryId}
        insightId={insight.id}
        current={insight.state ?? "new"}
      /> : null}
    </Alert>)}
  </Stack>;
}
