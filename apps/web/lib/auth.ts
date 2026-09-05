import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "../auth";
import { db, workspaceUserAccess } from "@tokenlens/database";

const resolveCurrentWorkspace = cache(async () => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const access = await workspaceUserAccess(userId);
  if (!access) return null;
  return {
    userId: access.userId,
    name: access.name,
    email: access.email,
    workspaceId: access.workspaceId,
    workspaceName: access.workspaceName,
    role: access.role,
  };
});

export const currentWorkspace = resolveCurrentWorkspace;

async function resolveWorkspace() {
  const access = await currentWorkspace();
  if (!access) redirect("/login");
  return access;
}

export const requireWorkspace = cache(resolveWorkspace);

export async function requireOwner() {
  const access = await requireWorkspace();
  if (access.role !== "owner") throw new Error("Workspace owner access required");
  return access;
}

export async function requireRepository(repositoryId: string) {
  const access = await requireWorkspace();
  const rows = await (await db()).query(
    "select id from repositories where id=$1::uuid and workspace_id=$2::uuid",
    [repositoryId, access.workspaceId],
  ) as { id: string }[];
  return rows[0] ? access : null;
}
