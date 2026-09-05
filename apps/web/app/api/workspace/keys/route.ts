import { NextResponse } from "next/server";
import { createWorkspaceApiKey, revokeWorkspaceApiKey } from "@tokenlens/database";
import { authorizeApi } from "../../../../lib/api-auth";

export async function POST(request: Request) {
  const authorization = await authorizeApi("owner");
  if (!authorization.ok) return authorization.response;
  const access = authorization.access;
  const body = await request.json().catch(() => ({})) as { name?: unknown };
  if (body.name != null && typeof body.name !== "string") {
    return NextResponse.json({ error: "invalid key name" }, { status: 400 });
  }
  const key = await createWorkspaceApiKey(access.workspaceId, access.userId, body.name ?? "CLI key");
  return NextResponse.json(key, { status: 201 });
}

export async function DELETE(request: Request) {
  const authorization = await authorizeApi("owner");
  if (!authorization.ok) return authorization.response;
  const access = authorization.access;
  const body = await request.json().catch(() => ({})) as { id?: unknown };
  if (typeof body.id !== "string") return NextResponse.json({ error: "invalid key" }, { status: 400 });
  try {
    const key = await revokeWorkspaceApiKey(access.workspaceId, body.id);
    return key ? NextResponse.json(key) : NextResponse.json({ error: "key not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "could not revoke key" }, { status: 409 });
  }
}
