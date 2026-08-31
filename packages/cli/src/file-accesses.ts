export type RawFileAccess = {
  kind: "read" | "edit";
  path: string;
  attribution: "explicit_tool" | "structured_action" | "shell_operand";
};

function shellSegments(command: string) {
  const segments: string[][] = [[]];
  let token = "";
  let quote = "";
  let escaped = false;
  const pushToken = () => {
    if (token) segments.at(-1)!.push(token);
    token = "";
  };
  const pushSegment = () => {
    pushToken();
    if (segments.at(-1)!.length) segments.push([]);
  };
  for (const character of command) {
    if (escaped) {
      token += character;
      escaped = false;
    } else if (character === "\\" && quote !== "'") {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = "";
      else token += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (/\s/.test(character)) {
      pushToken();
    } else if (character === ";" || character === "|" || character === "&") {
      pushSegment();
    } else {
      token += character;
    }
  }
  pushToken();
  return segments.filter((segment) => segment.length);
}

const base = (value: string) => value.split(/[\\/]/).at(-1) ?? value;
function positionals(args: string[], optionsWithValues = new Set<string>()) {
  const values: string[] = [];
  let options = true;
  for (let index = 0; index < args.length; index++) {
    const value = args[index];
    if (/^\d*[<>]{1,2}$/.test(value)) {
      index++;
    } else if (/^\d*[<>]{1,2}.+/.test(value)) {
      continue;
    } else if (options && value === "--") {
      options = false;
    } else if (options && optionsWithValues.has(value)) {
      index++;
    } else if (options && value.startsWith("-")) {
      continue;
    } else if (!/[<>]/.test(value)) {
      values.push(value);
    }
  }
  return values;
}

function commandReads(segment: string[]) {
  while (["rtk", "command"].includes(base(segment[0] ?? ""))) segment = segment.slice(1);
  const command = base(segment[0] ?? "");
  const args = segment.slice(1);
  if (["cat", "nl", "wc"].includes(command)) return positionals(args);
  if (["head", "tail"].includes(command))
    return positionals(args, new Set(["-c", "-n", "--bytes", "--lines"]));
  if (command === "sed") {
    const values = positionals(args, new Set(["-e", "-f", "--expression", "--file"]));
    const hasExpressionOption = args.includes("-e") || args.includes("--expression");
    return hasExpressionOption ? values : values.slice(1);
  }
  if (["rg", "grep"].includes(command)) {
    const values = positionals(args, new Set([
      "-A", "-B", "-C", "-e", "-f", "-g", "-m", "-t",
      "--after-context", "--before-context", "--context", "--encoding",
      "--glob", "--max-count", "--max-depth", "--regexp", "--type",
    ]));
    if (args.includes("--files") || args.includes("--files-with-matches")) return [];
    const hasExpressionOption = args.includes("-e") || args.includes("--regexp");
    return hasExpressionOption ? values : values.slice(1);
  }
  return [];
}

function structuredReads(input: any): RawFileAccess[] {
  const actions = input.command_actions ?? input.commandActions;
  if (!Array.isArray(actions)) return [];
  return actions.flatMap((action: any) => {
    if (String(action?.type ?? action?.action).toLowerCase() !== "read") return [];
    const value = action.path ?? action.file_path ?? action.filePath ?? action.name;
    return typeof value === "string"
      ? [{ kind: "read" as const, path: value, attribution: "structured_action" as const }]
      : [];
  });
}

function patchPaths(command: string) {
  return [...command.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)]
    .map((match) => match[1].trim());
}

export function rawFileAccesses(payload: any, provider: "claude" | "codex"): RawFileAccess[] {
  const input = payload.tool_input ?? payload.toolInput ?? {};
  const toolName = String(payload.tool_name ?? payload.toolName ?? "").toLowerCase();
  const direct = input.file_path ?? input.filePath ?? input.notebook_path ?? input.notebookPath ?? input.path;
  const editTools = new Set(["edit", "write", "notebookedit", "apply_patch"]);
  if (direct) return [{
    kind: editTools.has(toolName) ? "edit" : "read",
    path: String(direct),
    attribution: "explicit_tool",
  }];
  if (provider !== "codex") return [];
  if (toolName === "apply_patch") return patchPaths(String(input.command ?? input.patch ?? ""))
    .map((value) => ({ kind: "edit", path: value, attribution: "explicit_tool" }));
  const structured = structuredReads(input);
  if (structured.length) return structured;
  const command = input.command ?? input.cmd;
  if (typeof command !== "string") return [];
  return shellSegments(command).flatMap(commandReads)
    .map((value) => ({ kind: "read", path: value, attribution: "shell_operand" }));
}
