import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "../auth";
import { db } from "@tokenlens/database";

export async function currentWorkspace() {
  const session = await auth();
  const user = session?.user as ({
    id?: string;
    email?: string | null;
    workspaceId?: string;
    workspaceName?: string;
    workspaceRole?: "owner" | "member";
  }) | undefined;
  if (!user?.id || !user.workspaceId || !user.workspaceName || !user.workspaceRole) return null;
  return {
    userId: user.id,
    email: user.email ?? "",
    workspaceId: user.workspaceId,
    workspaceName: user.workspaceName,
    role: user.workspaceRole,
  };
}

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
