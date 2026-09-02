import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PromptBenchmarks, type PromptBenchmarkSummary } from "./prompt-benchmarks";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

const renderBenchmarks = (benchmarks: PromptBenchmarkSummary[]) =>
  renderToStaticMarkup(createElement(PromptBenchmarks, { benchmarks }));

describe("PromptBenchmarks", () => {
  it("renders benchmark details and regression health", () => {
    const markup = renderBenchmarks([{
      id: "benchmark-1",
      name: "Fix the auth flow",
      provider: "codex",
      model: "gpt-test",
      runs: 7,
      lastSeenAt: "2026-09-01T10:00:00.000Z",
      medianContext: 1_250,
      regression: true,
    }]);

    expect(markup).toContain('href="/benchmarks/benchmark-1"');
    expect(markup).toContain("Fix the auth flow");
    expect(markup).toContain("gpt-test");
    expect(markup).toContain("7 runs");
    expect(markup).toContain("median 1.3K context");
    expect(markup).toContain("Regression");
  });

  it("explains how to create the first benchmark", () => {
    const markup = renderBenchmarks([]);

    expect(markup).toContain("Create a benchmark from the detail page of a prompt");
  });
});
