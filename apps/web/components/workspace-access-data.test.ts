import { describe, expect, it } from "vitest";
import { workspaceAccessTableRows } from "./workspace-access-data";

const member = {
  id: "shared-id",
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "owner" as const,
  created_at: "2026-09-01T10:00:00Z",
};

const invitation = {
  id: "shared-id",
  email: "grace@example.com",
  role: "member" as const,
  created_at: "2026-09-02T10:00:00Z",
  expires_at: "2026-09-09T10:00:00Z",
  status: "invited" as const,
};

describe("workspaceAccessTableRows", () => {
  it("normalizes members and invitations with unique grid IDs", () => {
    const rows = workspaceAccessTableRows([member], [invitation], member.id);

    expect(rows.map((row) => row.id)).toEqual(["member:shared-id", "invitation:shared-id"]);
    expect(rows[0]).toMatchObject({
      entityId: "shared-id",
      displayName: "Ada Lovelace",
      status: "active",
      isCurrentUser: true,
      expiresAt: null,
    });
    expect(rows[1]).toMatchObject({
      entityId: "shared-id",
      displayName: "grace@example.com",
      status: "invited",
      isCurrentUser: false,
    });
  });

  it("preserves an expired invitation status", () => {
    const rows = workspaceAccessTableRows([], [{ ...invitation, status: "expired" }], "user-1");
    expect(rows[0].status).toBe("expired");
  });
});
