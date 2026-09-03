import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({ db: vi.fn() }));

vi.mock("./index", () => ({ db }));

import {
  createWorkspaceInvitation,
  listWorkspaceInvitations,
  updateUserProfile,
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
});
