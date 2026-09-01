import { describe, expect, it } from "vitest";
import type { ActionExample } from "@tokenlens/shared";
import {
  actionHref,
  architectureExample,
  benchmarkRegressionExample,
  cacheExample,
  hotspotExample,
  instructionChangeExample,
  instructionEffectivenessExample,
  modelComparisonExample,
  moduleBreadthExample,
  onboardingExample,
  promptComparisonExample,
  repeatedReadsExample,
  structuralEfficiencyExample,
  structuralGrowthExample,
  timeToEditExample,
  toolFailureExample,
} from "./action-examples";

const serialise = (example: ActionExample) => JSON.stringify(example);

describe("action examples", () => {
  const examples: [string, ActionExample][] = [
    ["benchmark regression", benchmarkRegressionExample({}, "Tool calls")],
    ["repeated reads", repeatedReadsExample()],
    ["time to edit", timeToEditExample()],
    ["module breadth", moduleBreadthExample()],
    ["cache", cacheExample()],
    ["generated hotspot", hotspotExample({ path: "generated/client.ts", generated: true, inCycle: false, loc: 100 })],
    ["cycle hotspot", hotspotExample({ path: "src/cycle.ts", generated: false, inCycle: true, loc: 100 })],
    ["large hotspot", hotspotExample({ path: "src/large.ts", generated: false, inCycle: false, loc: 900 })],
    ["general hotspot", hotspotExample({ path: "src/common.ts", generated: false, inCycle: false, loc: 100 })],
    ["tool failure", toolFailureExample("shell")],
    ["architecture module breadth", architectureExample("module-breadth")],
    ["architecture working set", architectureExample("working-set-loc")],
    ["architecture fan out", architectureExample("fan-out")],
    ["architecture cycles", architectureExample("cycle-files")],
    ["structural growth", structuralGrowthExample()],
    ["instruction change", instructionChangeExample()],
    ["instruction improvement", instructionEffectivenessExample("improved")],
    ["instruction regression", instructionEffectivenessExample("regressed")],
    ["instruction unchanged", instructionEffectivenessExample("unchanged")],
    ["structural efficiency", structuralEfficiencyExample()],
    ["onboarding", onboardingExample()],
    ["model comparison", modelComparisonExample("provider/a", "provider/b")],
    ["prompt above cohort", promptComparisonExample(true)],
    ["prompt below cohort", promptComparisonExample(false)],
  ];

  it.each(examples)("provides concrete ordered steps for %s", (_name, example) => {
    expect(example.title.trim()).not.toBe("");
    expect(example.steps.length).toBeGreaterThanOrEqual(3);
    expect(example.steps.every((step) => step.trim().length > 0)).toBe(true);
  });

  it("uses dynamic evidence names without exposing private telemetry", () => {
    const output = [
      hotspotExample({ path: "src/safe.ts", generated: false, inCycle: false, loc: 100 }),
      toolFailureExample("safe-tool"),
      modelComparisonExample("provider/model-a", "provider/model-b"),
    ].map(serialise).join(" ");
    expect(output).toContain("src/safe.ts");
    expect(output).toContain("safe-tool");
    expect(output).not.toMatch(/\/Users\/|developerId|promptText|tool output/i);
  });

  it("is deterministic for identical inputs and varies by recommendation branch", () => {
    expect(hotspotExample({ path: "src/a.ts", generated: false, inCycle: true, loc: 100 }))
      .toEqual(hotspotExample({ path: "src/a.ts", generated: false, inCycle: true, loc: 100 }));
    expect(serialise(instructionEffectivenessExample("improved")))
      .not.toEqual(serialise(instructionEffectivenessExample("regressed")));
    expect(serialise(promptComparisonExample(true))).not.toEqual(serialise(promptComparisonExample(false)));
  });

  it("builds scoped evidence links with encoded filters and anchors", () => {
    const scope = { repositoryId: "repo", provider: "Claude Code", model: "model/a" };
    expect(actionHref.hotspot(scope, "src/a b.ts"))
      .toBe("/repos/repo/hotspots?file=src%2Fa+b.ts&provider=Claude+Code&model=model%2Fa#evidence");
    expect(actionHref.tool(scope, "shell exec")).toContain("tool=shell+exec");
    expect(actionHref.promptWorkingSet({ promptId: "prompt" })).toBe("/prompts/prompt#working-set");
    expect(actionHref.promptBenchmark({ promptId: "prompt" })).toBe("/prompts/prompt#create-benchmark");
  });
});
