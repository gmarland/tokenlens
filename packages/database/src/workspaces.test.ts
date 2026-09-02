import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({ db: vi.fn() }));

vi.mock("./index", () => ({ db }));

import { updateUserProfile } from "./workspaces";

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
