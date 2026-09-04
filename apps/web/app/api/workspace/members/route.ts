import { NextResponse } from "next/server";
import {
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  WorkspaceMembershipError,
} from "@tokenlens/database";
import { requireOwner } from "../../../../lib/auth";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function membershipErrorResponse(error: unknown) {
  if (!(error instanceof WorkspaceMembershipError)) throw error;
  return NextResponse.json(
    { error: error.message },
    { status: error.code === "not_owner" ? 403 : 409 },
  );
}

export async function PATCH(request: Request) {
  const access = await requireOwner();
  const body = await request.json().catch(() => ({})) as { id?: unknown; role?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const role = body.role === "owner" ? "owner" : body.role === "member" ? "member" : null;
  if (!uuidPattern.test(id) || !role) {
    return NextResponse.json({ error: "A valid member and role are required." }, { status: 400 });
  }

  try {
    const member = await updateWorkspaceMemberRole(access.workspaceId, access.userId, id, role);
    return member
      ? NextResponse.json(member)
      : NextResponse.json({ error: "Workspace member not found." }, { status: 404 });
  } catch (error) {
    return membershipErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const access = await requireOwner();
  const body = await request.json().catch(() => ({})) as { id?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "A valid member is required." }, { status: 400 });
  }

  try {
    const member = await removeWorkspaceMember(access.workspaceId, access.userId, id);
    return member
      ? NextResponse.json(member)
      : NextResponse.json({ error: "Workspace member not found." }, { status: 404 });
  } catch (error) {
    return membershipErrorResponse(error);
  }
}
