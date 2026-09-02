import type { Metadata } from "next";
import Typography from "@mui/material/Typography";
import { listWorkspaceApiKeyManagementData } from "@tokenlens/database";
import { Page, Panel } from "../../components/ui";
import { requireWorkspace } from "../../lib/auth";
import ApiKeysClient from "./api-keys-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "API Keys — TokenLens",
};

export default async function ApiKeysPage() {
  const access = await requireWorkspace();
  if (access.role !== "owner") return <Page>
    <Typography variant="h1">API Keys</Typography>
    <Panel sx={{ p: 4, mt: 4 }}>
      <Typography>Only workspace owners can manage API keys and connected CLI installations.</Typography>
    </Panel>
  </Page>;

  const managementData = await listWorkspaceApiKeyManagementData(access.workspaceId);
  const serializable = JSON.parse(JSON.stringify(managementData));
  return <Page>
    <Typography variant="h1">API Keys</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>
      Manage the write-only credentials that send telemetry to {access.workspaceName}.
    </Typography>
    <ApiKeysClient
      initial={serializable}
      endpoint={process.env.NEXT_PUBLIC_INGEST_ENDPOINT ?? "http://localhost:3001"}
    />
  </Page>;
}
