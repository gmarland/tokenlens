import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { repositoryPromptsMock } = vi.hoisted(() => ({ repositoryPromptsMock: vi.fn() }));

vi.mock("../../../../../lib/data", () => ({ repositoryPrompts: repositoryPromptsMock }));

import { GET } from "./route";

describe("repository prompts route", () => {
  beforeEach(() => {
    repositoryPromptsMock.mockReset();
    repositoryPromptsMock.mockResolvedValue([]);
  });

  it("forwards search with the existing prompt filters", async () => {
    await GET(
      new NextRequest("http://localhost/api/repositories/repo-1/prompts?sort=files&model=gpt-test&provider=codex&search=fix%20auth"),
      { params: Promise.resolve({ id: "repo-1" }) },
    );

    expect(repositoryPromptsMock).toHaveBeenCalledWith(
      "repo-1",
      "files",
      "gpt-test",
      "codex",
      "fix auth",
    );
  });

  it("omits search when it is not supplied", async () => {
    await GET(
      new NextRequest("http://localhost/api/repositories/repo-1/prompts"),
      { params: Promise.resolve({ id: "repo-1" }) },
    );

    expect(repositoryPromptsMock).toHaveBeenCalledWith(
      "repo-1",
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });
});
