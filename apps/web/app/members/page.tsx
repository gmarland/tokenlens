import Typography from "@mui/material/Typography";
import { listWorkspaceInvitations, listWorkspaceMembers } from "@tokenlens/database";
import { Page, Panel } from "../../components/ui";
import { requireWorkspace } from "../../lib/auth";
import MembersClient from "./members-client";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const access = await requireWorkspace();
  if (access.role !== "owner") return <Page>
    <Typography variant="h1">Members</Typography>
    <Panel sx={{ p: 4, mt: 4 }}><Typography>Workspace owners manage members and invitations.</Typography></Panel>
  </Page>;

  const [members, invitations] = await Promise.all([
    listWorkspaceMembers(access.workspaceId),
    listWorkspaceInvitations(access.workspaceId),
  ]);
  const serializable = JSON.parse(JSON.stringify({ members, invitations }));
  return <Page>
    <Typography variant="h1">Members</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>Manage access to {access.workspaceName}.</Typography>
    <MembersClient initial={serializable} currentUserId={access.userId} />
  </Page>;
}
