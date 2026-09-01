import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
}));

vi.mock("../../../../../lib/data", () => ({
  BenchmarkValidationError: class BenchmarkValidationError extends Error {
    constructor(message: string, readonly status = 400) { super(message); }
  },
  createPromptBenchmark: mocks.create,
  repositoryBenchmarks: mocks.list,
}));

import { GET, POST } from "./route";

const repositoryId = "123e4567-e89b-42d3-a456-426614174000";
const promptId = "123e4567-e89b-42d3-a456-426614174001";

describe("repository benchmarks route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([]);
    mocks.create.mockResolvedValue({ id: "benchmark-1" });
  });

  it("lists repository benchmarks", async () => {
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: repositoryId }) });
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith(repositoryId);
  });

  it("creates a benchmark from a source prompt and model", async () => {
    const response = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourcePromptId: promptId, model: "gpt-test" }),
    }), { params: Promise.resolve({ id: repositoryId }) });

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(repositoryId, promptId, "gpt-test", undefined);
  });

  it("rejects malformed identifiers before querying", async () => {
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "repo-1" }) });
    expect(response.status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
