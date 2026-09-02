export type InsightSeverity = "info" | "opportunity" | "warning";
export type InsightConfidence = "low" | "medium" | "high";
export type InsightState = "new" | "acknowledged" | "monitoring" | "dismissed" | "resolved";

export type InsightEvidence = {
  label: string;
  value: number | string;
  baseline?: number | string | null;
  unit?: "count" | "percent" | "tokens" | "milliseconds" | "bytes" | "usd";
};

export type ActionExample = {
  title: string;
  steps: [string, ...string[]];
  snippet?: {
    language: "markdown" | "text";
    content: string;
  };
};

export type Insight = {
  id: string;
  rule: string;
  ruleVersion: number;
  scope: {
    workspaceId?: string;
    repositoryId?: string;
    benchmarkId?: string;
    promptId?: string;
    provider?: string;
    model?: string;
    branch?: string;
    startAt?: string;
  };
  severity: InsightSeverity;
  confidence: InsightConfidence;
  title: string;
  summary: string;
  evidence: InsightEvidence[];
  recommendation: { text: string; href?: string; example: ActionExample };
  validation: { text: string; benchmarkId?: string; metric?: string };
  caveats: string[];
  sampleSize: number;
  coverage: number | null;
  comparisonPeriod?: string;
  detectedAt: string;
  state?: InsightState;
};

export type PromptFact = {
  id: string;
  promptFingerprint?: string | null;
  promptText?: string | null;
  repositoryId: string;
  snapshotId: string | null;
  benchmarkId?: string | null;
  provider: string;
  model: string | null;
  branch: string | null;
  developerId: string | null;
  startedAt: string;
  provisional: boolean;
  hasUsage: boolean;
  cacheMetricsAvailable: boolean;
  freshInputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
  contextTokens: number;
  costUsd: number | null;
  responseDurationMs: number;
  apiCalls: number;
  toolCalls: number;
  knownToolOutcomes: number;
  failedTools: number;
  toolDurationMs: number | null;
  toolResultBytes: number | null;
  fileAttributionAvailable: boolean;
  totalReads: number | null;
  filesRead: number | null;
  repeatedReads: number | null;
  filesEdited: number | null;
  modulesVisited: number | null;
  workingSetLoc: number | null;
  largestFileLoc: number | null;
  meanFanOut: number | null;
  cycleFiles: number | null;
  timeToFirstEditMs: number | null;
};

export type BenchmarkFact = Pick<PromptFact,
  "id" | "startedAt" | "provisional" | "contextTokens" | "outputTokens" |
  "responseDurationMs" | "apiCalls" | "toolCalls" | "failedTools" |
  "filesRead" | "filesEdited" | "repeatedReads" | "timeToFirstEditMs"
> & {
  costUsd: number | null;
  modulesVisited?: number | null;
  toolResultBytes?: number | null;
  snapshotId?: string | null;
  headSha?: string | null;
};

export type FileHotspot = {
  path: string;
  moduleName: string;
  prompts: number;
  promptShare: number;
  reads: number;
  repeatedReads: number;
  medianContext: number;
  contextLiftPercent: number | null;
  highContextPromptShare: number;
  loc: number;
  fanIn: number;
  fanOut: number;
  crossModuleDependencies: number;
  inCycle: boolean;
  generated: boolean;
};

export type ToolHealth = {
  toolName: string;
  category: string;
  calls: number;
  knownOutcomes: number;
  failedCalls: number;
  failureRate: number | null;
  medianDurationMs: number | null;
  p95DurationMs: number | null;
  medianResultBytes: number | null;
  p95ResultBytes: number | null;
};

export type SnapshotDelta = {
  snapshotId: string;
  previousSnapshotId: string | null;
  capturedAt: string;
  headSha: string;
  branch: string;
  dirty: boolean;
  totalSourceLoc: number;
  sourceFiles: number;
  modules: number;
  filesOver500Loc: number;
  filesOver1000Loc: number;
  dependencyCycleCount: number;
  crossModuleEdgeRatio: number;
  p95FanOut: number;
  testToSourceRatio: number;
  instructionBytes: number;
  instructionFiles: number;
  instructionFingerprint: string | null;
  instructionChanged: boolean | null;
  locDelta: number | null;
  sourceFilesDelta: number | null;
  modulesDelta: number | null;
  cyclesDelta: number | null;
  crossModuleRatioDelta: number | null;
  instructionBytesDelta: number | null;
};

export type MatchedModelComparison = {
  promptFingerprint: string;
  promptText: string;
  provider: string;
  model: string;
  runs: number;
  medianContext: number;
  medianDurationMs: number;
  medianCostUsd: number | null;
  medianFilesRead: number | null;
  failureRate: number | null;
};
