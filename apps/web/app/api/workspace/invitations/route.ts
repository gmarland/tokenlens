import { NextResponse } from "next/server";
import { createWorkspaceInvitation } from "@tokenlens/database";
import { requireOwner } from "../../../../lib/auth";
import { sendWorkspaceInvitation } from "../../../../lib/email";

export async function POST(request: Request) {
  const access = await requireOwner();
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
