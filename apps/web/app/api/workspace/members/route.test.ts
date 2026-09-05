import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class WorkspaceMembershipError extends Error {
    constructor(
      public readonly code: "not_owner" | "self_management" | "last_owner",
      message: string,
    ) {
      super(message);
    }
  }
  return {
    removeWorkspaceMember: vi.fn(),
    requireOwner: vi.fn(),
    updateWorkspaceMemberRole: vi.fn(),
    WorkspaceMembershipError,
  };
});

vi.mock("../../../../lib/api-auth", () => ({
  authorizeApi: async () => ({ ok: true, access: await mocks.requireOwner() }),
}));
vi.mock("@tokenlens/database", () => ({
  removeWorkspaceMember: mocks.removeWorkspaceMember,
  updateWorkspaceMemberRole: mocks.updateWorkspaceMemberRole,
  WorkspaceMembershipError: mocks.WorkspaceMembershipError,
}));

import { DELETE, PATCH } from "./route";

const actorId = "00000000-0000-4000-8000-000000000001";
const memberId = "00000000-0000-4000-8000-000000000002";

function request(method: "PATCH" | "DELETE", body: unknown) {
  return new Request("http://localhost/api/workspace/members", {
    method,
    body: JSON.stringify(body),
  });
}

describe("workspace members route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOwner.mockResolvedValue({ workspaceId: "workspace-1", userId: actorId });
    mocks.updateWorkspaceMemberRole.mockResolvedValue({ id: memberId, role: "owner" });
    mocks.removeWorkspaceMember.mockResolvedValue({ id: memberId });
  });

  it("changes a workspace member's role", async () => {
    const response = await PATCH(request("PATCH", { id: memberId, role: "owner" }));

    expect(response.status).toBe(200);
    expect(mocks.updateWorkspaceMemberRole).toHaveBeenCalledWith(
      "workspace-1",
      actorId,
      memberId,
      "owner",
    );
    await expect(response.json()).resolves.toEqual({ id: memberId, role: "owner" });
  });

  it("removes only the target workspace membership", async () => {
    const response = await DELETE(request("DELETE", { id: memberId }));

    expect(response.status).toBe(200);
    expect(mocks.removeWorkspaceMember).toHaveBeenCalledWith("workspace-1", actorId, memberId);
    await expect(response.json()).resolves.toEqual({ id: memberId });
  });

  it("rejects invalid member input", async () => {
    const response = await PATCH(request("PATCH", { id: "not-a-uuid", role: "admin" }));

    expect(response.status).toBe(400);
    expect(mocks.updateWorkspaceMemberRole).not.toHaveBeenCalled();
  });

  it("returns not found for a member outside the workspace", async () => {
    mocks.removeWorkspaceMember.mockResolvedValue(null);

    const response = await DELETE(request("DELETE", { id: memberId }));

    expect(response.status).toBe(404);
  });

  it("returns a conflict when a membership safeguard rejects the change", async () => {
    mocks.updateWorkspaceMemberRole.mockRejectedValue(
      new mocks.WorkspaceMembershipError("self_management", "You cannot change your own workspace role."),
    );

    const response = await PATCH(request("PATCH", { id: memberId, role: "member" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "You cannot change your own workspace role.",
    });
  });

  it("returns forbidden when the actor is no longer an owner", async () => {
    mocks.removeWorkspaceMember.mockRejectedValue(
      new mocks.WorkspaceMembershipError("not_owner", "Workspace owner access required."),
    );

    const response = await DELETE(request("DELETE", { id: memberId }));

    expect(response.status).toBe(403);
  });
});
