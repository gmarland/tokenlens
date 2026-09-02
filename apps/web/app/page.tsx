import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { spearman, relationship } from "@tokenlens/analytics";
import { ScatterPlot } from "../components/charts";
import { RepositoriesDataTable } from "../components/data-tables";
import { AnalysisFilters } from "../components/filters";
import { InsightCards } from "../components/insight-cards";
import {
  Cards,
  EmptyState,
  Eyebrow,
  Intro,
  Label,
  MetricCard,
  Page,
  Panel,
  SectionTitle,
  Toolbar,
} from "../components/ui";
import { overview } from "../lib/data";
import { repositoryInsightBundle, sortInsights } from "../lib/insights";
import { compact } from "../lib/format";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ model?: string; provider?: string }>;
}) {
  const q = await searchParams;
  const data = await overview(q.model, q.provider);
  const { summary: s, repositories, models, providers } = data;
  const scope = `${q.provider ?? "all providers"} · ${q.model ?? "all models"}`;
  const qualified = repositories.filter((r: any) => r.prompts >= 10 && r.loc);
  const rho =
    qualified.length >= 5
      ? spearman(
          qualified.map((r: any) => Number(r.loc)),
          qualified.map((r: any) => Number(r.median_context)),
        )
      : null;
  const query = new URLSearchParams();
  if (q.model) query.set("model", q.model);
  if (q.provider) query.set("provider", q.provider);
  const repositoryNames = Object.fromEntries(
    repositories.map((repository: any) => [
      String(repository.id),
      String(repository.name),
    ]),
  );
  const actionCentre = sortInsights(
    (
      await Promise.all(
        repositories.slice(0, 10).map(async (repository: any) => {
          const bundle = await repositoryInsightBundle(repository.id, {
            model: q.model,
            provider: q.provider,
          });
          return bundle.insights
            .filter(
              (insight) =>
                !["dismissed", "resolved"].includes(insight.state ?? "new"),
            )
            .map((insight) => ({
              ...insight,
              recommendation: {
                ...insight.recommendation,
                href:
                  insight.recommendation.href ??
                  `/repos/${repository.id}/insights${query.size ? `?${query}` : ""}`,
              },
            }));
        }),
      )
    ).flat(),
  ).slice(0, 5);

  return (
    <Page>
      <Box sx={{ mb: 6 }}>
        <Toolbar>
          <Box>
            <Eyebrow>Codebase efficiency profiler</Eyebrow>
            <Typography variant="h1" sx={{ mt: 0.75 }}>
              Repository context, made visible.
            </Typography>
          </Box>
        </Toolbar>
      </Box>
      <Cards>
        <MetricCard label="Repositories" value={compact(s.repositories)} />
        <MetricCard label="Developers" value={compact(s.developers)} />
        <MetricCard label="Prompts observed" value={compact(s.prompts)} />
        <MetricCard
          label="Context tokens processed"
          value={compact(s.context_tokens)}
        />
      </Cards>

      <SectionTitle>Action centre</SectionTitle>
      <Panel sx={{ mb: { xs: 3, md: 5 } }}>
        <InsightCards
          insights={actionCentre}
          repositoryNames={repositoryNames}
          empty="No repository insights currently meet the evidence thresholds."
        />
      </Panel>

      <SectionTitle>Repositories</SectionTitle>
      <AnalysisFilters
        key={`${q.provider ?? ""}:${q.model ?? ""}`}
        idPrefix="overview"
        initialProvider={q.provider}
        initialModel={q.model}
        providers={providers.map((p: any) => ({
          value: p.provider,
          label: p.provider === "codex" ? "Codex" : "Claude Code",
        }))}
        models={models.map((m: any) => ({ value: m.model, label: m.model }))}
        modelLabel="Analysis model"
      />

      {repositories.length ? (
        <RepositoriesDataTable
          queryString={query.size ? `?${query}` : ""}
          rows={repositories.map((r: any) => ({
            id: String(r.id),
            name: String(r.name),
            sourceFiles: Number(r.source_files ?? 0),
            loc: Number(r.loc ?? 0),
            prompts: Number(r.prompts ?? 0),
            medianContext: Number(r.median_context ?? 0),
            medianFiles: Number(r.median_files ?? 0),
          }))}
        />
      ) : (
        <Panel sx={{ p: 0 }}>
          <EmptyState>
            No telemetry yet. Install the profiler to begin collecting
            repository data.
          </EmptyState>
        </Panel>
      )}

      <SectionTitle>Repository LOC vs median context</SectionTitle>
      <Panel>
        <ScatterPlot
          data={repositories.map((r: any) => ({
            loc: Number(r.loc),
            context: Number(r.median_context),
          }))}
          x="loc"
          y="context"
        />
        {rho !== null ? (
          <Typography sx={{ mt: 1 }}>
            <Box component="strong">ρ = {rho.toFixed(2)}</Box> · n ={" "}
            {qualified.length} repositories · {relationship(rho)} for{" "}
            <Box component="strong">{scope}</Box>.
          </Typography>
        ) : (
          <Label>
            Raw observations for {scope} are shown. A cross-repository
            correlation requires at least 5 repositories with 10 prompts each.
          </Label>
        )}
      </Panel>

      <Alert
        id="methodology"
        severity="warning"
        variant="outlined"
        sx={{ mt: 3 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Methodological limitation
        </Typography>
        <Typography>
          Token usage is affected by task complexity, developer behaviour, model
          selection, session history, tools, provider, and repository structure.
          Correlations shown here identify observed relationships, not
          causation.
        </Typography>
      </Alert>
    </Page>
  );
}
