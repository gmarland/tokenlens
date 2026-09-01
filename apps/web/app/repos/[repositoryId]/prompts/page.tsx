import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { PromptsDataTable } from "../../../../components/data-tables";
import Link from "../../../../components/link";
import {
  BackLink,
  EmptyState,
  Eyebrow,
  Intro,
  Page,
  Panel,
} from "../../../../components/ui";
import { repositoryPrompts } from "../../../../lib/data";

export const dynamic = "force-dynamic";

export default async function Prompts({ params, searchParams }: any) {
  const id = (await params).repositoryId;
  const q = await searchParams;
  const search = typeof q.search === "string" ? q.search.trim() : "";
  const rows = await repositoryPrompts(id, q.sort, q.model, q.provider, search);
  const back = new URLSearchParams();
  if (q.model) back.set("model", q.model);
  if (q.provider) back.set("provider", q.provider);
  const clearSearch = new URLSearchParams();
  if (q.sort) clearSearch.set("sort", q.sort);
  if (q.model) clearSearch.set("model", q.model);
  if (q.provider) clearSearch.set("provider", q.provider);

  return (
    <Page>
      <BackLink href={`/repos/${id}${back.size ? `?${back}` : ""}`}>
        ← Repository
      </BackLink>
      <Eyebrow sx={{ mt: 3 }}>Prompt explorer</Eyebrow>
      <Typography variant="h1">Observed prompts</Typography>
      <Stack
        component="form"
        method="get"
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ mt: 4, maxWidth: 760 }}
      >
        {q.sort ? <input type="hidden" name="sort" value={q.sort} /> : null}
        {q.model ? <input type="hidden" name="model" value={q.model} /> : null}
        {q.provider ? (
          <input type="hidden" name="provider" value={q.provider} />
        ) : null}
        <TextField
          defaultValue={search}
          fullWidth
          label="Search prompts"
          name="search"
          placeholder="Search prompt bodies"
          size="small"
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
        <Button type="submit" variant="contained">
          Search
        </Button>
        {search ? (
          <Button
            component={Link}
            href={`/repos/${id}/prompts${clearSearch.size ? `?${clearSearch}` : ""}`}
            variant="outlined"
          >
            Clear
          </Button>
        ) : null}
      </Stack>
      {rows.length ? (
        <PromptsDataTable
          initialSort={q.sort}
          rows={rows.map((p: any) => ({
            id: String(p.id),
            startedAt: new Date(p.started_at).toISOString(),
            provider: String(p.provider),
            developer: String(p.email ?? "Identity pending"),
            prompt: p.prompt_text
              ? String(p.prompt_text).slice(0, 60)
              : `Legacy prompt #${String(p.external_prompt_id).slice(0, 8)}`,
            model: String(p.model ?? "—"),
            context: Number(p.context_tokens ?? 0),
            cost: p.cost_usd == null ? null : Number(p.cost_usd),
            files: Number(p.files_read ?? 0),
            repeatedReads: Number(p.repeated_reads ?? 0),
            modules: Number(p.modules ?? 0),
            apiCalls: Number(p.api_calls ?? 0),
            firstEdit:
              p.time_to_first_edit_ms == null
                ? null
                : Number(p.time_to_first_edit_ms),
          }))}
        />
      ) : (
        <Panel sx={{ p: 0 }}>
          <EmptyState>
            {search
              ? "No prompts match this search and the current filters."
              : "No prompts match these filters."}
          </EmptyState>
        </Panel>
      )}
    </Page>
  );
}
