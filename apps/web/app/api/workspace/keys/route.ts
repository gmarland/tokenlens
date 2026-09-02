import { NextResponse } from "next/server";
import { createWorkspaceApiKey, revokeWorkspaceApiKey } from "@tokenlens/database";
import { requireOwner } from "../../../../lib/auth";

export async function POST(request: Request) {
  const access = await requireOwner();
  const body = await request.json().catch(() => ({})) as { name?: unknown };
  if (body.name != null && typeof body.name !== "string") {
    return NextResponse.json({ error: "invalid key name" }, { status: 400 });
  }
  const key = await createWorkspaceApiKey(access.workspaceId, access.userId, body.name ?? "CLI key");
  return NextResponse.json(key, { status: 201 });
}

export async function DELETE(request: Request) {
  const access = await requireOwner();
  const body = await request.json().catch(() => ({})) as { id?: unknown };
  if (typeof body.id !== "string") return NextResponse.json({ error: "invalid key" }, { status: 400 });
  try {
    const key = await revokeWorkspaceApiKey(access.workspaceId, body.id);
    return key ? NextResponse.json(key) : NextResponse.json({ error: "key not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "could not revoke key" }, { status: 409 });
  }
}
