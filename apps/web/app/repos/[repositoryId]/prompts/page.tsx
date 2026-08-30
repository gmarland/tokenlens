import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Link from "../../../../components/link";
import { BackLink, EmptyState, Eyebrow, Intro, Page, ResponsiveTable, numericCellSx } from "../../../../components/ui";
import { repositoryPrompts } from "../../../../lib/data";
import { compact, money, duration, date } from "../../../../lib/format";

export const dynamic = "force-dynamic";

export default async function Prompts({ params, searchParams }: any) {
  const id = (await params).repositoryId;
  const q = await searchParams;
  const rows = await repositoryPrompts(id, q.sort, q.model, q.provider);
  const href = (sort: string) => {
    const p = new URLSearchParams({ sort });
    if (q.model) p.set("model", q.model);
    if (q.provider) p.set("provider", q.provider);
    return `?${p}`;
  };
  const back = new URLSearchParams();
  if (q.model) back.set("model", q.model);
  if (q.provider) back.set("provider", q.provider);
  const sortLink = (label: string, sort: string) => <MuiLink component={Link} href={href(sort)} color="primary" sx={{ fontWeight: 600 }}>{label}</MuiLink>;

  return <Page>
    <BackLink href={`/repos/${id}${back.size ? `?${back}` : ""}`}>← Repository</BackLink>
    <Eyebrow sx={{ mt: 3 }}>Prompt explorer</Eyebrow>
    <Typography variant="h1">Observed prompts</Typography>
    <Intro>Prompt bodies are captured and attributed to the provider identity reported for the session. Sort by {sortLink("context", "context")}, {sortLink("cost", "cost")}, {sortLink("files", "files")}, {sortLink("repeated reads", "repeated")}, or {sortLink("first edit", "edit")}.</Intro>
    <ResponsiveTable>
      {rows.length ? <Table size="small">
        <TableHead><TableRow>
          {['Time','Provider','Developer','Prompt','Model'].map((x) => <TableCell key={x}>{x}</TableCell>)}
          {['Context','Cost','Files','Modules','API calls','First edit'].map((x) => <TableCell key={x} sx={numericCellSx}>{x}</TableCell>)}
        </TableRow></TableHead>
        <TableBody>{rows.map((p: any) => <TableRow key={p.id} hover>
          <TableCell>{date(p.started_at)}</TableCell><TableCell><Chip size="small" label={p.provider} /></TableCell>
          <TableCell>{p.email ?? "Identity pending"}</TableCell><TableCell><MuiLink component={Link} href={`/prompts/${p.id}`} color="inherit" sx={{ fontWeight: 650 }}>{p.prompt_text ? p.prompt_text.slice(0, 60) : `Legacy prompt #${p.external_prompt_id.slice(0, 8)}`}</MuiLink></TableCell>
          <TableCell><Chip size="small" label={p.model ?? "—"} /></TableCell>
          <TableCell sx={numericCellSx}>{compact(p.context_tokens)}</TableCell><TableCell sx={numericCellSx}>{money(p.cost_usd)}</TableCell>
          <TableCell sx={numericCellSx}>{p.files_read ?? 0}</TableCell><TableCell sx={numericCellSx}>{p.modules ?? 0}</TableCell>
          <TableCell sx={numericCellSx}>{p.api_calls ?? 0}</TableCell><TableCell sx={numericCellSx}>{duration(p.time_to_first_edit_ms)}</TableCell>
        </TableRow>)}</TableBody>
      </Table> : <EmptyState>No prompts match these filters.</EmptyState>}
    </ResponsiveTable>
  </Page>;
}
