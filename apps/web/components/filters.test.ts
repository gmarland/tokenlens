import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnalysisFilters } from "./filters";

const renderFilters = (initialProvider?: string, initialModel?: string) =>
  renderToStaticMarkup(createElement(AnalysisFilters, {
    idPrefix: "repository",
    initialProvider,
    initialModel,
    modelLabel: "Model",
    providers: [{ label: "Codex", value: "codex" }],
    models: [{ label: "GPT test", value: "gpt-test" }],
  }));

describe("AnalysisFilters", () => {
  it("omits unset provider and model fields from GET submissions", () => {
    const markup = renderFilters();

    expect(markup).not.toContain('name="provider"');
    expect(markup).not.toContain('name="model"');
  });

  it("includes provider and model fields when filters are set", () => {
    const markup = renderFilters("codex", "gpt-test");

    expect(markup).toContain('name="provider"');
    expect(markup).toContain('name="model"');
  });
});
