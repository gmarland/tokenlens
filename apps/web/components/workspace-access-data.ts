export type WorkspaceMember = {
  id: string;
  name: string | null;
  email: string;
  role: "owner" | "member";
  created_at: string;
};

export type WorkspaceInvitation = {
  id: string;
  email: string;
  role: "owner" | "member";
  created_at: string;
  expires_at: string;
  status: "invited" | "expired";
};

export type WorkspaceAccessTableRow = {
  id: string;
  entityId: string;
  type: "member" | "invitation";
  displayName: string;
  email: string;
  role: "owner" | "member";
  status: "active" | "invited" | "expired";
  createdAt: string;
  expiresAt: string | null;
  isCurrentUser: boolean;
};

export function workspaceAccessTableRows(
  members: WorkspaceMember[],
  invitations: WorkspaceInvitation[],
  currentUserId: string,
): WorkspaceAccessTableRow[] {
  return [
    ...members.map((member) => ({
      id: `member:${member.id}`,
      entityId: member.id,
      type: "member" as const,
      displayName: member.name || member.email,
      email: member.email,
      role: member.role,
      status: "active" as const,
      createdAt: member.created_at,
      expiresAt: null,
      isCurrentUser: member.id === currentUserId,
    })),
    ...invitations.map((invitation) => ({
      id: `invitation:${invitation.id}`,
      entityId: invitation.id,
      type: "invitation" as const,
      displayName: invitation.email,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      createdAt: invitation.created_at,
      expiresAt: invitation.expires_at,
      isCurrentUser: false,
    })),
  ];
}
