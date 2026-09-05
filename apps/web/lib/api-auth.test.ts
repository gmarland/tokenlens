import { beforeEach, describe, expect, it, vi } from "vitest";

const currentWorkspace = vi.hoisted(() => vi.fn());
vi.mock("./auth", () => ({ currentWorkspace }));

import { authorizeApi } from "./api-auth";

describe("API authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns JSON 401 without an authenticated workspace", async () => {
    currentWorkspace.mockResolvedValue(null);
    const result = await authorizeApi();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("returns JSON 403 when a member calls an owner endpoint", async () => {
    currentWorkspace.mockResolvedValue({ role: "member" });
    const result = await authorizeApi("owner");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    await expect(result.response.json()).resolves.toEqual({ error: "forbidden" });
  });

  it("returns current access for an authorized request", async () => {
    const access = { role: "owner", userId: "user-1", workspaceId: "workspace-1" };
    currentWorkspace.mockResolvedValue(access);
    await expect(authorizeApi("owner")).resolves.toEqual({ ok: true, access });
  });
});
