import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWorkspaceInvitation: vi.fn(),
  requireOwner: vi.fn(),
  sendWorkspaceInvitation: vi.fn(),
}));

vi.mock("../../../../lib/auth", () => ({
  requireOwner: mocks.requireOwner,
}));
vi.mock("../../../../lib/email", () => ({
  sendWorkspaceInvitation: mocks.sendWorkspaceInvitation,
}));
vi.mock("@tokenlens/database", () => ({
  createWorkspaceInvitation: mocks.createWorkspaceInvitation,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/workspace/invitations", {
    method: "POST",
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

  it("rejects invalid input before creating an invitation", async () => {
    const response = await POST(request({ email: "not-an-email", role: "member" }));

    expect(response.status).toBe(400);
    expect(mocks.createWorkspaceInvitation).not.toHaveBeenCalled();
  });
});
