import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({ db: vi.fn() }));

vi.mock("./index", () => ({ db }));

import {
  createWorkspaceInvitation,
  listWorkspaceInvitations,
  removeWorkspaceInvitation,
  removeWorkspaceMember,
  updateUserProfile,
  updateWorkspaceInvitationRole,
  updateWorkspaceMemberRole,
  workspaceUserAccess,
  WorkspaceMembershipError,
} from "./workspaces";

describe("user profiles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes profile fields and clears verification only when the email changes", async () => {
    const query = vi.fn(async () => [{
      id: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
    }]);
    db.mockResolvedValue({ query });

    await expect(updateUserProfile("user-1", {
      name: "  Ada Lovelace  ",
      email: "  ADA@EXAMPLE.COM  ",
    })).resolves.toEqual({
      id: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('case when email is distinct from $3 then null else "emailVerified" end'),
      ["user-1", "Ada Lovelace", "ada@example.com"],
    );
  });

  it("returns null when the session user no longer exists", async () => {
    db.mockResolvedValue({ query: vi.fn(async () => []) });
    await expect(updateUserProfile("missing-user", {
      name: "Ada",
      email: "ada@example.com",
    })).resolves.toBeNull();
  });
});

describe("authenticated workspace access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads current profile and membership values for a JWT identity", async () => {
    const access = {
      userId: "user-1",
      workspaceId: "workspace-1",
      workspaceName: "Analytical Engines",
      role: "member",
      name: "Ada Lovelace",
      email: "ada@example.com",
    };
    const query = vi.fn(async () => [access]);
    db.mockResolvedValue({ query });

    await expect(workspaceUserAccess("user-1")).resolves.toEqual(access);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("join users u on u.id=m.user_id"),
      ["user-1"],
    );
  });

  it("rejects a JWT identity whose user or membership no longer exists", async () => {
    db.mockResolvedValue({ query: vi.fn(async () => []) });
    await expect(workspaceUserAccess("missing-user")).resolves.toBeNull();
  });
});

describe("workspace invitations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists unaccepted invitations without duplicating active members", async () => {
    const invitations = [{
      id: "invitation-1",
      email: "grace@example.com",
      role: "member",
      status: "invited",
    }];
    const query = vi.fn(async () => invitations);
    db.mockResolvedValue({ query });

    await expect(listWorkspaceInvitations("workspace-1")).resolves.toEqual(invitations);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("i.accepted_at is null"),
      ["workspace-1"],
    );
    expect(query.mock.calls[0][0]).toContain("not exists");
    expect(query.mock.calls[0][0]).toContain("'expired'");
  });

  it("does not create an invitation for an existing member", async () => {
    const query = vi.fn(async () => []);
    db.mockResolvedValue({ query });

    await expect(createWorkspaceInvitation(
      "workspace-1",
      "owner-1",
      "  ADA@EXAMPLE.COM  ",
      "member",
    )).resolves.toBeNull();

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("from workspace_memberships m join users u"),
      expect.arrayContaining(["workspace-1", "owner-1", "ada@example.com", "member"]),
    );
    expect(query.mock.calls[0][0]).toContain("created_at=now()");
  });

  it("updates an unaccepted invitation within the workspace", async () => {
    const updated = { id: "invitation-1", email: "ada@example.com", role: "owner", status: "invited" };
    const query = vi.fn(async () => [updated]);
    db.mockResolvedValue({ query });

    await expect(updateWorkspaceInvitationRole(
      "workspace-1",
      "invitation-1",
      "owner",
    )).resolves.toEqual(updated);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("accepted_at is null"),
      ["workspace-1", "invitation-1", "owner"],
    );
  });

  it("removes only an unaccepted invitation from the workspace", async () => {
    const query = vi.fn(async () => [{ id: "invitation-1" }]);
    db.mockResolvedValue({ query });

    await expect(removeWorkspaceInvitation(
      "workspace-1",
      "invitation-1",
    )).resolves.toEqual({ id: "invitation-1" });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("delete from workspace_invitations"),
      ["workspace-1", "invitation-1"],
    );
    expect(query.mock.calls[0][0]).toContain("accepted_at is null");
  });
});

describe("workspace member management", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates another member's role inside a workspace-locked transaction", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ role: "owner" }])
      .mockResolvedValueOnce([{ role: "member" }])
      .mockResolvedValueOnce([{ id: "member-1", role: "owner" }]);
    const transaction = vi.fn(async (callback) => callback({ query }));
    db.mockResolvedValue({ transaction });

    await expect(updateWorkspaceMemberRole(
      "workspace-1",
      "owner-1",
      "member-1",
      "owner",
    )).resolves.toEqual({ id: "member-1", role: "owner" });

    expect(query.mock.calls[0][0]).toContain("for update of w");
    expect(query.mock.calls[2]).toEqual([
      expect.stringContaining("update workspace_memberships"),
      ["workspace-1", "member-1", "owner"],
    ]);
  });

  it("checks owner count before removing an owner", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ role: "owner" }])
      .mockResolvedValueOnce([{ role: "owner" }])
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([{ id: "owner-2" }]);
    db.mockResolvedValue({ transaction: vi.fn(async (callback) => callback({ query })) });

    await expect(removeWorkspaceMember(
      "workspace-1",
      "owner-1",
      "owner-2",
    )).resolves.toEqual({ id: "owner-2" });

    expect(query.mock.calls[2][0]).toContain("role='owner'");
    expect(query.mock.calls[3][0]).toContain("delete from workspace_memberships");
  });

  it("rejects self-management", async () => {
    const query = vi.fn().mockResolvedValueOnce([{ role: "owner" }]);
    db.mockResolvedValue({ transaction: vi.fn(async (callback) => callback({ query })) });

    await expect(removeWorkspaceMember(
      "workspace-1",
      "owner-1",
      "owner-1",
    )).rejects.toMatchObject<Partial<WorkspaceMembershipError>>({ code: "self_management" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("preserves the final owner", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ role: "owner" }])
      .mockResolvedValueOnce([{ role: "owner" }])
      .mockResolvedValueOnce([{ count: 1 }]);
    db.mockResolvedValue({ transaction: vi.fn(async (callback) => callback({ query })) });

    await expect(updateWorkspaceMemberRole(
      "workspace-1",
      "owner-1",
      "owner-2",
      "member",
    )).rejects.toMatchObject<Partial<WorkspaceMembershipError>>({ code: "last_owner" });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("rejects a stale non-owner actor inside the transaction", async () => {
    const query = vi.fn().mockResolvedValueOnce([{ role: "member" }]);
    db.mockResolvedValue({ transaction: vi.fn(async (callback) => callback({ query })) });

    await expect(removeWorkspaceMember(
      "workspace-1",
      "former-owner",
      "member-1",
    )).rejects.toMatchObject<Partial<WorkspaceMembershipError>>({ code: "not_owner" });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
