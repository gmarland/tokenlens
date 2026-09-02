import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { correlations } from "@tokenlens/analytics";
import { notFound } from "next/navigation";
import { AnalysisFilters } from "../../../../components/filters";
import { RepositoryNav } from "../../../../components/repository-nav";
import { RepositoryBehaviourTimeline } from "../../../../components/repository-timelines";
import { BackLink, Cards, EmptyState, Eyebrow, Intro, Label, Page, Panel, SectionTitle, Toolbar } from "../../../../components/ui";
import { repository } from "../../../../lib/data";

export const dynamic = "force-dynamic";

export default async function Behaviour({ params, searchParams }: PageProps<"/repos/[repositoryId]/behaviour">) {
  const { repositoryId } = await params;
  const query = await searchParams;
  const provider = typeof query.provider === "string" ? query.provider : undefined;
  const model = typeof query.model === "string" ? query.model : undefined;
  const data = await repository(repositoryId, model, provider);
  if (!data) notFound();
  const filterQuery = new URLSearchParams();
  if (provider) filterQuery.set("provider", provider);
  if (model) filterQuery.set("model", model);
  const promptHref = `/repos/${repositoryId}/prompts${filterQuery.size ? `?${filterQuery}` : ""}`;
  const correlationsByContext = correlations(data.prompts, (prompt: any) => Number(prompt.context_tokens), {
    "Working-set LOC": (prompt) => Number(prompt.working_loc),
    "Largest file read": (prompt) => Number(prompt.max_file_loc),
    "Files read": (prompt) => Number(prompt.files_read),
    "Repeated reads": (prompt) => Number(prompt.repeated_reads),
    "Module count": (prompt) => Number(prompt.modules),
    "Dependency fan-out": (prompt) => Number(prompt.mean_fan_out),
    "Tool-result size": (prompt) => Number(prompt.tool_bytes),
  });

  return <Page>
    <BackLink href="/">← All repositories</BackLink>
    <Toolbar>
      <Box sx={{ mt: 3 }}>
        <Eyebrow>Observed agent activity</Eyebrow>
        <Typography variant="h1">Agent behaviour · {data.repo.name}</Typography>
        <Intro>Prompt-level context and traversal patterns for {provider ?? "all providers"} · {model ?? "all models"}.</Intro>
      </Box>
      <AnalysisFilters
        idPrefix="behaviour"
        initialProvider={provider}
        initialModel={model}
        providers={data.providers.map((item: any) => ({ value: item.provider, label: item.provider }))}
        models={data.models.map((item: any) => ({ value: item.model, label: item.model }))}
        modelLabel="Model"
      />
    </Toolbar>
    <RepositoryNav repositoryId={repositoryId} queryString={filterQuery.toString()} />
    <RepositoryBehaviourTimeline
      behaviourKey={`${provider ?? ""}:${model ?? ""}`}
      promptHref={promptHref}
      prompts={data.prompts.map((prompt: any) => ({
        id: prompt.id,
        startedAt: new Date(prompt.started_at).toISOString(),
        context: Number(prompt.context_tokens),
        files: Number(prompt.files_read),
        branch: prompt.branch,
        developerId: prompt.developer_id,
        developerLabel: prompt.email,
      }))}
    />
    <SectionTitle>Observed relationships</SectionTitle>
    {correlationsByContext.length ? <Cards compact>
      {correlationsByContext.map((correlation) => <Card variant="outlined" key={correlation.name}>
        <CardContent>
          <Label>{correlation.name} ↔ context processed</Label>
          <Typography sx={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.04em", color: "info.main" }}>
            ρ = {correlation.rho!.toFixed(2)}
          </Typography>
        </CardContent>
      </Card>)}
    </Cards> : <Panel><EmptyState>At least 20 prompts matching the current filters are required before correlations are displayed.</EmptyState></Panel>}
  </Page>;
}
