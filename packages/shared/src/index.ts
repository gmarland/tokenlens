import { z } from "zod";

export const providerSchema = z.enum(["claude", "codex"]);
export type Provider = z.infer<typeof providerSchema>;

export const relativePath = z
  .string()
  .min(1)
  .refine(
    (p) => !p.startsWith("/") && !p.split(/[\\/]/).includes(".."),
    "must be a safe repository-relative path",
  );

export const promptHookSchema = z.object({
  provider: providerSchema.default("claude"),
  promptId: z.string().min(1),
  sessionId: z.string().min(1),
  promptLength: z.number().int().nonnegative(),
  promptText: z.string(),
  model: z.string().optional(),
  repoKey: z.string().min(1).optional(),
  repoName: z.string().optional(),
  remoteHost: z.string().optional(),
  remoteOwner: z.string().optional(),
  remoteName: z.string().optional(),
  branch: z.string().optional(),
  headSha: z.string().optional(),
  dirty: z.boolean().optional(),
  snapshotFingerprint: z.string().optional(),
  startedAt: z.string().datetime().optional(),
});

export const toolHookSchema = z.object({
  provider: providerSchema.default("claude"),
  promptId: z.string().min(1),
  sessionId: z.string().min(1),
  toolUseId: z.string().min(1),
  toolName: z.string().min(1).max(255),
  relativeFilePath: relativePath.optional(),
  fileAccesses: z.array(z.object({
    kind: z.enum(["read", "edit"]),
    relativeFilePath: relativePath,
    attribution: z.enum(["explicit_tool", "structured_action", "shell_operand"]),
  })).max(100).optional(),
  timestamp: z.string().datetime().optional(),
});

export const fileMetricSchema = z.object({
  path: relativePath,
  language: z.string(),
  extension: z.string(),
  bytes: z.number().int().nonnegative(),
  loc: z.number().int().nonnegative(),
  directoryDepth: z.number().int().nonnegative(),
  moduleName: z.string(),
  isTest: z.boolean(),
  isGenerated: z.boolean(),
  isDocumentation: z.boolean(),
  dependencyFanIn: z.number().int().nonnegative(),
  dependencyFanOut: z.number().int().nonnegative(),
  crossModuleDependencies: z.number().int().nonnegative(),
  inDependencyCycle: z.boolean(),
});

export const snapshotSchema = z.object({
  repoKey: z.string(),
  repoName: z.string(),
  remoteHost: z.string().optional(),
  remoteOwner: z.string().optional(),
  remoteName: z.string().optional(),
  fingerprint: z.string(),
  headSha: z.string(),
  branch: z.string(),
  dirty: z.boolean(),
  capturedAt: z.string().datetime(),
  metrics: z.record(z.string(), z.unknown()),
  files: z.array(fileMetricSchema).max(100000),
});

export type PromptHook = z.infer<typeof promptHookSchema>;
export type ToolHook = z.infer<typeof toolHookSchema>;
export type SnapshotUpload = z.infer<typeof snapshotSchema>;
export type FileMetric = z.infer<typeof fileMetricSchema>;
