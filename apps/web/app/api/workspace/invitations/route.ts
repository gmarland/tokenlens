import { NextResponse } from "next/server";
import {
  createWorkspaceInvitation,
  removeWorkspaceInvitation,
  updateWorkspaceInvitationRole,
} from "@tokenlens/database";
import { authorizeApi } from "../../../../lib/api-auth";
import { sendWorkspaceInvitation } from "../../../../lib/email";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const authorization = await authorizeApi("owner");
  if (!authorization.ok) return authorization.response;
  const access = authorization.access;
  const body = await request.json().catch(() => ({})) as { email?: unknown; role?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role === "owner" ? "owner" : body.role === "member" ? "member" : null;
  if (!/^\S+@\S+\.\S+$/.test(email) || !role) {
    return NextResponse.json({ error: "valid email and role are required" }, { status: 400 });
  }
  const invitation = await createWorkspaceInvitation(access.workspaceId, access.userId, email, role);
  if (!invitation) {
    return NextResponse.json({ error: "That email address is already a workspace member." }, { status: 409 });
  }
  const emailSent = await sendWorkspaceInvitation({
    email,
    workspaceName: access.workspaceName,
    inviterEmail: access.email,
  }).catch(() => false);
  return NextResponse.json({
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      created_at: invitation.created_at,
      expires_at: invitation.expires_at,
      status: invitation.status,
    },
    emailSent,
  }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authorization = await authorizeApi("owner");
  if (!authorization.ok) return authorization.response;
  const access = authorization.access;
  const body = await request.json().catch(() => ({})) as { id?: unknown; role?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const role = body.role === "owner" ? "owner" : body.role === "member" ? "member" : null;
  if (!uuidPattern.test(id) || !role) {
    return NextResponse.json({ error: "A valid invitation and role are required." }, { status: 400 });
  }

  const invitation = await updateWorkspaceInvitationRole(access.workspaceId, id, role);
  return invitation
    ? NextResponse.json(invitation)
    : NextResponse.json({ error: "Workspace invitation not found." }, { status: 404 });
}

export async function DELETE(request: Request) {
  const authorization = await authorizeApi("owner");
  if (!authorization.ok) return authorization.response;
  const access = authorization.access;
  const body = await request.json().catch(() => ({})) as { id?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "A valid invitation is required." }, { status: 400 });
  }

  const invitation = await removeWorkspaceInvitation(access.workspaceId, id);
  return invitation
    ? NextResponse.json(invitation)
    : NextResponse.json({ error: "Workspace invitation not found." }, { status: 404 });
}
