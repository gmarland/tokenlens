import { describe, expect, it } from "vitest";
import { rawFileAccesses } from "./file-accesses";

describe("privacy-safe file access extraction", () => {
  it("keeps explicit reads and edits", () => {
    expect(rawFileAccesses({ tool_name: "Read", tool_input: { file_path: "/repo/a.ts" } }, "claude"))
      .toEqual([{ kind: "read", path: "/repo/a.ts", attribution: "explicit_tool" }]);
    expect(rawFileAccesses({ tool_name: "apply_patch", tool_input: {
      command: "*** Begin Patch\n*** Update File: src/a.ts\n*** Add File: src/b.ts\n*** End Patch",
    } }, "codex")).toEqual([
      { kind: "edit", path: "src/a.ts", attribution: "explicit_tool" },
      { kind: "edit", path: "src/b.ts", attribution: "explicit_tool" },
    ]);
  });

  it("extracts only explicit shell file operands", () => {
    expect(rawFileAccesses({ tool_name: "Bash", tool_input: {
      cmd: "rtk sed -n '1,80p' src/a.ts; rg -n 'needle' src/b.ts . && cat 'src/c file.ts'",
    } }, "codex")).toEqual([
      { kind: "read", path: "src/a.ts", attribution: "shell_operand" },
      { kind: "read", path: "src/b.ts", attribution: "shell_operand" },
      { kind: "read", path: ".", attribution: "shell_operand" },
      { kind: "read", path: "src/c file.ts", attribution: "shell_operand" },
    ]);
  });

  it("prefers structured read actions and ignores unknown commands", () => {
    expect(rawFileAccesses({ tool_name: "Bash", tool_input: {
      command_actions: [{ type: "read", path: "src/a.ts" }],
      cmd: "python script.py",
    } }, "codex")).toEqual([
      { kind: "read", path: "src/a.ts", attribution: "structured_action" },
    ]);
    expect(rawFileAccesses({ tool_name: "Bash", tool_input: { cmd: "python script.py" } }, "codex"))
      .toEqual([]);
  });

  it("does not mistake redirection targets for input files", () => {
    expect(rawFileAccesses({ tool_name: "Bash", tool_input: {
      cmd: "cat src/input.ts > src/output.ts; head -n 5 src/other.ts 2>errors.log",
    } }, "codex")).toEqual([
      { kind: "read", path: "src/input.ts", attribution: "shell_operand" },
      { kind: "read", path: "src/other.ts", attribution: "shell_operand" },
    ]);
  });
});
