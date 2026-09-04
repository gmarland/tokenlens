import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWorkspaceInvitation: vi.fn(),
  removeWorkspaceInvitation: vi.fn(),
  requireOwner: vi.fn(),
  sendWorkspaceInvitation: vi.fn(),
  updateWorkspaceInvitationRole: vi.fn(),
}));

vi.mock("../../../../lib/auth", () => ({
  requireOwner: mocks.requireOwner,
}));
vi.mock("../../../../lib/email", () => ({
  sendWorkspaceInvitation: mocks.sendWorkspaceInvitation,
}));
vi.mock("@tokenlens/database", () => ({
  createWorkspaceInvitation: mocks.createWorkspaceInvitation,
  removeWorkspaceInvitation: mocks.removeWorkspaceInvitation,
  updateWorkspaceInvitationRole: mocks.updateWorkspaceInvitationRole,
}));

import { DELETE, PATCH, POST } from "./route";

function request(body: unknown, method: "POST" | "PATCH" | "DELETE" = "POST") {
  return new Request("http://localhost/api/workspace/invitations", {
    method,
    body: JSON.stringify(body),
  });
}

describe("workspace invitation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOwner.mockResolvedValue({
      workspaceId: "workspace-1",
      workspaceName: "Analytical Engines",
      userId: "owner-1",
      email: "owner@example.com",
    });
    mocks.createWorkspaceInvitation.mockResolvedValue({
      id: "invitation-1",
      email: "ada@example.com",
      role: "member",
      created_at: "2026-09-02T10:00:00.000Z",
      expires_at: "2026-09-09T10:00:00.000Z",
      status: "invited",
      token: "secret-token",
    });
    mocks.sendWorkspaceInvitation.mockResolvedValue(true);
    mocks.updateWorkspaceInvitationRole.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000002",
      email: "ada@example.com",
      role: "owner",
      created_at: "2026-09-02T10:00:00.000Z",
      expires_at: "2026-09-09T10:00:00.000Z",
      status: "invited",
    });
    mocks.removeWorkspaceInvitation.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000002",
    });
  });

  it("returns display-safe invitation data", async () => {
    const response = await POST(request({ email: " ADA@EXAMPLE.COM ", role: "member" }));

    expect(response.status).toBe(201);
    expect(mocks.createWorkspaceInvitation).toHaveBeenCalledWith(
      "workspace-1",
      "owner-1",
      "ada@example.com",
      "member",
    );
    await expect(response.json()).resolves.toEqual({
      invitation: {
        id: "invitation-1",
        email: "ada@example.com",
        role: "member",
        created_at: "2026-09-02T10:00:00.000Z",
        expires_at: "2026-09-09T10:00:00.000Z",
        status: "invited",
      },
      emailSent: true,
    });
  });

  it("returns a conflict and does not send email for an existing member", async () => {
    mocks.createWorkspaceInvitation.mockResolvedValue(null);

    const response = await POST(request({ email: "member@example.com", role: "member" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "That email address is already a workspace member.",
    });
    expect(mocks.sendWorkspaceInvitation).not.toHaveBeenCalled();
  });

  it("creates the invitation when Resend delivery fails", async () => {
    mocks.sendWorkspaceInvitation.mockRejectedValue(new Error("Resend unavailable"));

    const response = await POST(request({ email: "ada@example.com", role: "member" }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      invitation: { email: "ada@example.com" },
      emailSent: false,
    });
  });

  it("rejects invalid input before creating an invitation", async () => {
    const response = await POST(request({ email: "not-an-email", role: "member" }));

    expect(response.status).toBe(400);
    expect(mocks.createWorkspaceInvitation).not.toHaveBeenCalled();
  });

  it("changes an invited user's role", async () => {
    const id = "00000000-0000-4000-8000-000000000002";
    const response = await PATCH(request({ id, role: "owner" }, "PATCH"));

    expect(response.status).toBe(200);
    expect(mocks.updateWorkspaceInvitationRole).toHaveBeenCalledWith("workspace-1", id, "owner");
    expect((await response.json()).role).toBe("owner");
  });

  it("deletes an outstanding invitation", async () => {
    const id = "00000000-0000-4000-8000-000000000002";
    const response = await DELETE(request({ id }, "DELETE"));

    expect(response.status).toBe(200);
    expect(mocks.removeWorkspaceInvitation).toHaveBeenCalledWith("workspace-1", id);
  });

  it("does not update accepted, missing, or cross-workspace invitations", async () => {
    mocks.updateWorkspaceInvitationRole.mockResolvedValue(null);
    const id = "00000000-0000-4000-8000-000000000002";

    const response = await PATCH(request({ id, role: "member" }, "PATCH"));

    expect(response.status).toBe(404);
  });
});
