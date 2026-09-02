import Typography from "@mui/material/Typography";
import { listWorkspaceSettings } from "@tokenlens/database";
import { Page, Panel } from "../../components/ui";
import { requireWorkspace } from "../../lib/auth";
import SettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const access = await requireWorkspace();
  if (access.role !== "owner") return <Page>
    <Typography variant="h1">{access.workspaceName}</Typography>
    <Panel sx={{ p: 4, mt: 4 }}><Typography>Workspace owners manage API keys and CLI installations.</Typography></Panel>
  </Page>;
  const settings = await listWorkspaceSettings(access.workspaceId);
  const serializable = JSON.parse(JSON.stringify(settings));
  return <Page>
    <Typography variant="h1">{access.workspaceName}</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>Ingestion keys and CLI installations.</Typography>
    <Panel sx={{ p: 4 }}><SettingsClient initial={serializable} endpoint={process.env.NEXT_PUBLIC_INGEST_ENDPOINT ?? "http://localhost:3001"} /></Panel>
  </Page>;
}
