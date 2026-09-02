import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireWorkspace: vi.fn(),
  updateUserProfile: vi.fn(),
}));

vi.mock("../../../lib/auth", () => ({
  requireWorkspace: mocks.requireWorkspace,
}));
vi.mock("@tokenlens/database", () => ({
  updateUserProfile: mocks.updateUserProfile,
}));

import { PATCH } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("profile route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireWorkspace.mockResolvedValue({ userId: "session-user" });
    mocks.updateUserProfile.mockResolvedValue({
      id: "session-user",
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
  });

  it("updates the authenticated user with normalized fields", async () => {
    const response = await PATCH(request({
      name: "  Ada Lovelace  ",
      email: "  ADA@EXAMPLE.COM  ",
      userId: "another-user",
    }));

    expect(response.status).toBe(200);
    expect(mocks.updateUserProfile).toHaveBeenCalledWith("session-user", {
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
    await expect(response.json()).resolves.toEqual({
      id: "session-user",
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
  });

  it.each([
    [{ name: "", email: "ada@example.com" }, "Name is required"],
    [{ name: "a".repeat(101), email: "ada@example.com" }, "100 characters"],
    [{ name: "Ada", email: "not-an-email" }, "valid email"],
    [{ name: "Ada", email: `${"a".repeat(250)}@example.com` }, "valid email"],
  ])("rejects invalid profile input", async (body, message) => {
    const response = await PATCH(request(body));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain(message);
    expect(mocks.updateUserProfile).not.toHaveBeenCalled();
  });

  it("returns a conflict when the email belongs to another user", async () => {
    mocks.updateUserProfile.mockRejectedValue({ driverError: { code: "23505" } });
    const response = await PATCH(request({ name: "Ada", email: "used@example.com" }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "That email address is already in use.",
    });
  });

  it("returns not found for a stale session user", async () => {
    mocks.updateUserProfile.mockResolvedValue(null);
    const response = await PATCH(request({ name: "Ada", email: "ada@example.com" }));
    expect(response.status).toBe(404);
  });
});
