import { describe, expect, it } from "vitest";
import { canonicalToolActions, toolCategory } from "./tool-events";

describe("tool event presentation", () => {
  it("pairs Codex hook and telemetry completions", () => {
    const actions = canonicalToolActions([
      {
        tool_use_id: "call_1",
        tool_name: "exec",
        success: true,
        duration_ms: 230,
        timestamp: "2026-08-31T09:57:13.081Z",
        ingest_source: "otel",
      },
      {
        tool_use_id: "exec-1",
        tool_name: "Bash",
        timestamp: "2026-08-31T09:57:13.424Z",
        ingest_source: "hook",
      },
    ]);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      toolName: "Bash",
      category: "shell",
      success: true,
      durationMs: 230,
    });
    expect([...actions[0].sources]).toEqual(["hook", "otel"]);
  });

  it("groups multi-file patches and retains every observed path", () => {
    const actions = canonicalToolActions([
      {
        tool_use_id: "patch-1:0",
        tool_name: "Edit",
        relative_file_path: "src/a.ts",
        timestamp: "2026-08-31T10:00:00.100Z",
        ingest_source: "hook",
      },
      {
        tool_use_id: "patch-1:1",
        tool_name: "Edit",
        relative_file_path: "src/b.ts",
        timestamp: "2026-08-31T10:00:00.101Z",
        ingest_source: "hook",
      },
      {
        tool_use_id: "call_patch",
        tool_name: "apply_patch",
        success: true,
        timestamp: "2026-08-31T10:00:00.000Z",
        ingest_source: "otel",
      },
    ]);

    expect(actions).toHaveLength(1);
    expect(actions[0].rows.flatMap((row) => row.relative_file_path ?? [])).toEqual([
      "src/a.ts",
      "src/b.ts",
    ]);
  });

  it("keeps unpaired and legacy events visible", () => {
    expect(canonicalToolActions([
      { tool_use_id: "only-otel", tool_name: "update_plan", ingest_source: "otel" },
      { tool_use_id: "legacy", tool_name: "Read", ingest_source: "unknown" },
    ])).toHaveLength(2);
  });

  it("normalizes provider-specific tool names", () => {
    expect(toolCategory("exec_command")).toBe("shell");
    expect(toolCategory("apply_patch")).toBe("edit");
    expect(toolCategory("mcp__github__search")).toBe("mcp");
  });
});
