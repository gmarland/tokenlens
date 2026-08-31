export type ToolEventRow = {
  tool_use_id: string;
  tool_name?: string | null;
  success?: boolean | null;
  duration_ms?: number | null;
  tool_input_size_bytes?: number | null;
  tool_result_size_bytes?: number | null;
  relative_file_path?: string | null;
  timestamp?: string | Date | null;
  ingest_source?: "hook" | "otel" | "unknown" | null;
  [key: string]: unknown;
};

export type ToolCategory =
  | "shell"
  | "read"
  | "search"
  | "edit"
  | "planning"
  | "mcp"
  | "other";

export type CanonicalToolAction = {
  toolUseId: string;
  toolName: string;
  category: ToolCategory;
  success: boolean | null;
  durationMs: number | null;
  toolInputSizeBytes: number | null;
  toolResultSizeBytes: number | null;
  timestamp: string | Date | null;
  sources: Set<string>;
  rows: ToolEventRow[];
};

const shellTools = new Set(["bash", "exec", "exec_command", "shell"]);
const readTools = new Set(["read"]);
const searchTools = new Set(["glob", "grep", "search"]);
const editTools = new Set(["edit", "write", "notebookedit", "apply_patch"]);
const planningTools = new Set(["update_plan"]);

export function toolCategory(name?: string | null): ToolCategory {
  const normalized = name?.toLowerCase() ?? "";
  if (shellTools.has(normalized)) return "shell";
  if (readTools.has(normalized)) return "read";
  if (searchTools.has(normalized)) return "search";
  if (editTools.has(normalized)) return "edit";
  if (planningTools.has(normalized)) return "planning";
  if (normalized.startsWith("mcp__")) return "mcp";
  return "other";
}

const present = <T>(values: (T | null | undefined)[]) =>
  values.find((value): value is T => value !== null && value !== undefined) ?? null;

function action(rows: ToolEventRow[]): CanonicalToolAction {
  const first = rows[0];
  const toolName = present(rows.map((row) => row.tool_name)) ?? "Unknown tool";
  const timestamps = rows
    .map((row) => row.timestamp)
    .filter((value): value is string | Date => value !== null && value !== undefined)
    .sort((a, b) => +new Date(a) - +new Date(b));
  return {
    toolUseId: first.tool_use_id.replace(/:\d+$/, ""),
    toolName,
    category: toolCategory(toolName),
    success: present(rows.map((row) => row.success)),
    durationMs: present(rows.map((row) => row.duration_ms)),
    toolInputSizeBytes: present(rows.map((row) => row.tool_input_size_bytes)),
    toolResultSizeBytes: present(rows.map((row) => row.tool_result_size_bytes)),
    timestamp: timestamps[0] ?? null,
    sources: new Set(rows.map((row) => row.ingest_source ?? "unknown")),
    rows,
  };
}

function merge(preferred: CanonicalToolAction, telemetry: CanonicalToolAction) {
  return {
    ...preferred,
    success: preferred.success ?? telemetry.success,
    durationMs: preferred.durationMs ?? telemetry.durationMs,
    toolInputSizeBytes:
      preferred.toolInputSizeBytes ?? telemetry.toolInputSizeBytes,
    toolResultSizeBytes:
      preferred.toolResultSizeBytes ?? telemetry.toolResultSizeBytes,
    sources: new Set([...preferred.sources, ...telemetry.sources]),
    rows: [...preferred.rows, ...telemetry.rows],
  } satisfies CanonicalToolAction;
}

const milliseconds = (value: string | Date | null) =>
  value == null ? Number.NaN : +new Date(value);

/**
 * Codex reports a completed tool through both OTEL and PostToolUse. The two
 * transports currently expose different IDs, so pair same-category completion
 * events emitted within two seconds. Hook data is canonical because it carries
 * privacy-filtered repository-relative paths; OTEL enriches it with outcomes and
 * timings. Unpaired events remain visible for installations using one transport.
 */
export function canonicalToolActions(rows: ToolEventRow[]) {
  const hookGroups = new Map<string, ToolEventRow[]>();
  const telemetry: CanonicalToolAction[] = [];
  const other: CanonicalToolAction[] = [];

  for (const row of rows) {
    if (row.ingest_source === "hook") {
      const key = row.tool_use_id.replace(/:\d+$/, "");
      hookGroups.set(key, [...(hookGroups.get(key) ?? []), row]);
    } else if (row.ingest_source === "otel") {
      telemetry.push(action([row]));
    } else {
      other.push(action([row]));
    }
  }

  const hooks = [...hookGroups.values()].map(action);
  const usedTelemetry = new Set<number>();
  const paired = hooks.map((hook) => {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    telemetry.forEach((candidate, index) => {
      if (usedTelemetry.has(index) || candidate.category !== hook.category) return;
      const distance = Math.abs(milliseconds(candidate.timestamp) - milliseconds(hook.timestamp));
      if (distance <= 2_000 && distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    if (bestIndex < 0) return hook;
    usedTelemetry.add(bestIndex);
    return merge(hook, telemetry[bestIndex]);
  });

  return [...paired, ...telemetry.filter((_, index) => !usedTelemetry.has(index)), ...other]
    .sort((a, b) => milliseconds(a.timestamp) - milliseconds(b.timestamp));
}
