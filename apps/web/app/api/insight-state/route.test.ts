import { beforeEach, describe, expect, it, vi } from "vitest";

const { setState } = vi.hoisted(() => ({ setState: vi.fn() }));
vi.mock("@tokenlens/database/analytics", () => ({ setRepositoryInsightState: setState }));

import { POST } from "./route";

const repositoryId = "11111111-1111-4111-8111-111111111111";

describe("insight state route", () => {
  beforeEach(() => {
    setState.mockReset();
    setState.mockResolvedValue({ insight_id: "rule:repo", state: "monitoring" });
  });

  it("stores a validated workflow state", async () => {
    const response = await POST(new Request("http://localhost/api/insight-state", {
      method: "POST",
      body: JSON.stringify({ repositoryId, insightId: "rule:repo", state: "monitoring" }),
    }));
    expect(response.status).toBe(200);
    expect(setState).toHaveBeenCalledWith(repositoryId, "rule:repo", "monitoring");
  });

  it("rejects unknown states", async () => {
    const response = await POST(new Request("http://localhost/api/insight-state", {
      method: "POST",
      body: JSON.stringify({ repositoryId, insightId: "rule:repo", state: "ignored" }),
    }));
    expect(response.status).toBe(400);
    expect(setState).not.toHaveBeenCalled();
  });
});
