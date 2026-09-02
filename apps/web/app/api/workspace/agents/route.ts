import { NextResponse } from "next/server";
import { revokeAgentInstallation } from "@tokenlens/database";
import { requireOwner } from "../../../../lib/auth";

export async function DELETE(request: Request) {
  const access = await requireOwner();
  const body = await request.json().catch(() => ({})) as { id?: unknown };
  if (typeof body.id !== "string") return NextResponse.json({ error: "invalid installation" }, { status: 400 });
  const agent = await revokeAgentInstallation(access.workspaceId, body.id);
  return agent ? NextResponse.json(agent) : NextResponse.json({ error: "installation not found" }, { status: 404 });
}
