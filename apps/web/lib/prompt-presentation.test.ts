import { describe, expect, it } from "vitest";
import { parsePromptPresentation, promptTitle } from "./prompt-presentation";

const idePrompt = (request: string, newline = "\n") => [
  "# Context from my IDE setup:",
  "",
  "## Active file: src/auth.ts",
  "",
  "## Open tabs:",
  "- auth.ts: src/auth.ts",
  "",
  "## My request:",
  request,
].join(newline);

describe("prompt presentation", () => {
  it("extracts the request from a Codex IDE prompt", () => {
    const prompt = idePrompt("diagnose this issue and plan a fix");

    expect(parsePromptPresentation(prompt)).toEqual({
      rawText: prompt,
      requestText: "diagnose this issue and plan a fix",
      hasIdeContext: true,
    });
    expect(promptTitle(prompt, 100)).toBe("diagnose this issue and plan a fix");
  });

  it("supports CRLF prompts and collapses multiline titles", () => {
    const prompt = idePrompt("fix the prompt\r\nwithout changing matching", "\r\n");

    expect(parsePromptPresentation(prompt).requestText).toBe("fix the prompt\nwithout changing matching");
    expect(promptTitle(prompt, 100)).toBe("fix the prompt without changing matching");
  });

  it("leaves ordinary prompts unchanged", () => {
    const prompt = "Review this text:\n## My request:\nDo not extract it";

    expect(parsePromptPresentation(prompt)).toEqual({
      rawText: prompt,
      requestText: prompt,
      hasIdeContext: false,
    });
  });

  it("does not extract a malformed IDE envelope", () => {
    const prompt = "# Context from my IDE setup:\n\n## My request: inline text";

    expect(parsePromptPresentation(prompt).hasIdeContext).toBe(false);
    expect(promptTitle(prompt, 100)).toBe("# Context from my IDE setup: ## My request: inline text");
  });

  it("uses the fallback for an empty request and truncates after extraction", () => {
    expect(promptTitle(idePrompt(""), 100, "Benchmark prompt")).toBe("Benchmark prompt");
    expect(promptTitle(idePrompt("abcdefghij"), 6)).toBe("abcdef");
  });
});
