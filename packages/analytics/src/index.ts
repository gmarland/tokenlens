export * from "./statistics";
export * from "./insights";
import { spearman } from "./statistics";
export type ApiUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  durationMs: number;
  timestamp: Date;
  model: string;
};
export type ToolUsage = {
  toolName: string;
  relativeFilePath?: string | null;
  fileAccessKind?: "read" | "edit" | null;
  toolResultSizeBytes: number;
  timestamp: Date;
};
export function aggregatePrompt(api: ApiUsage[], tools: ToolUsage[]) {
  const sum = (f: (x: ApiUsage) => number) => api.reduce((n, x) => n + f(x), 0);
  const reads = tools.filter(
      (t) => (t.fileAccessKind === "read" || (!t.fileAccessKind && t.toolName === "Read")) && t.relativeFilePath,
    ),
    edits = tools.filter(
      (t) =>
        (t.fileAccessKind === "edit" || (!t.fileAccessKind && ["Edit", "Write", "NotebookEdit"].includes(t.toolName))) &&
        t.relativeFilePath,
    ),
    uniqueReads = new Set(reads.map((x) => x.relativeFilePath));
  const firstEdit = edits.map((x) => +x.timestamp).sort()[0];
  return {
    apiRequestCount: api.length,
    freshInputTokens: sum((x) => x.inputTokens),
    cacheReadTokens: sum((x) => x.cacheReadTokens),
    cacheCreationTokens: sum((x) => x.cacheCreationTokens),
    outputTokens: sum((x) => x.outputTokens),
    inputContextTokens: sum(
      (x) => x.inputTokens + x.cacheReadTokens + x.cacheCreationTokens,
    ),
    totalProcessedTokens: sum(
      (x) =>
        x.inputTokens +
        x.cacheReadTokens +
        x.cacheCreationTokens +
        x.outputTokens,
    ),
    costUsd: sum((x) => x.costUsd),
    toolCallCount: tools.length,
    toolResultBytes: tools.reduce((n, x) => n + x.toolResultSizeBytes, 0),
    readCount: reads.length,
    uniqueFilesRead: uniqueReads.size,
    repeatedFileReads: reads.length - uniqueReads.size,
    filesEdited: edits.length,
    uniqueFilesEdited: new Set(edits.map((x) => x.relativeFilePath)).size,
    timeToFirstEditMs:
      firstEdit && api[0]
        ? firstEdit - Math.min(...api.map((x) => +x.timestamp))
        : null,
  };
}
export function correlations<T>(
  rows: T[],
  target: (r: T) => number,
  dimensions: Record<string, (r: T) => number>,
  minimum = 20,
) {
  if (rows.length < minimum) return [];
  return Object.entries(dimensions)
    .map(([name, get]) => ({
      name,
      rho: spearman(rows.map(target), rows.map(get)),
      n: rows.length,
    }))
    .filter((x) => x.rho !== null)
    .sort((a, b) => Math.abs(b.rho!) - Math.abs(a.rho!));
}
