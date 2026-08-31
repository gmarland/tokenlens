import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { repositoryMock } = vi.hoisted(() => ({ repositoryMock: vi.fn() }));

vi.mock("../../../../../lib/data", () => ({ repository: repositoryMock }));

import { GET } from "./route";

const prompts = Array.from({ length: 20 }, (_, index) => ({
  context_tokens: index + 1,
  working_loc: index + 1,
  files_read: index + 1,
  repeated_reads: index + 1,
  modules: index + 1,
  mean_fan_out: index + 1,
  tool_bytes: index + 1,
}));

describe("repository analytics route", () => {
  beforeEach(() => {
    repositoryMock.mockReset();
    repositoryMock.mockResolvedValue({ repo: {}, prompts, models: [], providers: [] });
  });

  it("runs analytics across all providers and models by default", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/repositories/repo-1/analytics"),
      { params: Promise.resolve({ id: "repo-1" }) },
    );
    const body = await response.json();

    expect(repositoryMock).toHaveBeenCalledWith("repo-1", undefined, undefined);
    expect(body).toMatchObject({ model: null, provider: null, n: 20 });
    expect(body).not.toHaveProperty("modelRequired");
    expect(body.correlations).not.toHaveLength(0);
  });

  it.each([
    ["provider only", "?provider=codex", undefined, "codex"],
    ["model only", "?model=gpt-test", "gpt-test", undefined],
    ["provider and model", "?provider=codex&model=gpt-test", "gpt-test", "codex"],
  ])("forwards %s filters", async (_name, query, model, provider) => {
    const response = await GET(
      new NextRequest(`http://localhost/api/repositories/repo-1/analytics${query}`),
      { params: Promise.resolve({ id: "repo-1" }) },
    );
    const body = await response.json();

    expect(repositoryMock).toHaveBeenCalledWith("repo-1", model, provider);
    expect(body).toMatchObject({ model: model ?? null, provider: provider ?? null, n: 20 });
  });
});
