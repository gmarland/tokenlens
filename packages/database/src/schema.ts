import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  numeric,
  jsonb,
  uniqueIndex,
  index,
  real,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").defaultRandom().primaryKey();
const created = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  ingestKeyHash: text("ingest_key_hash").notNull().unique(),
  capturePrompts: boolean("capture_prompts").default(false).notNull(),
  isDemo: boolean("is_demo").default(false).notNull(),
  createdAt: created(),
});

export const developers = pgTable(
  "developers",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    provider: text("provider").default("claude").notNull(),
    externalId: text("external_id"),
    email: text("email"),
    firstSeenAt: created(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("developer_workspace_idx").on(t.workspaceId),
    uniqueIndex("developer_workspace_provider_external_uq").on(
      t.workspaceId,
      t.provider,
      t.externalId,
    ),
  ],
);

export const repositories = pgTable(
  "repositories",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    repoKey: text("repo_key").notNull(),
    name: text("name").notNull(),
    remoteHost: text("remote_host"),
    remoteOwner: text("remote_owner"),
    remoteName: text("remote_name"),
    createdAt: created(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("repository_workspace_key_uq").on(t.workspaceId, t.repoKey),
  ],
);

export const repoSnapshots = pgTable(
  "repo_snapshots",
  {
    id: id(),
    repositoryId: uuid("repository_id")
      .references(() => repositories.id, { onDelete: "cascade" })
      .notNull(),
    fingerprint: text("fingerprint").notNull(),
    headSha: text("head_sha").notNull(),
    branch: text("branch").notNull(),
    dirty: boolean("dirty").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    trackedFiles: integer("tracked_files").notNull(),
    sourceFiles: integer("source_files").notNull(),
    totalSourceLoc: bigint("total_source_loc", { mode: "number" }).notNull(),
    medianFileLoc: real("median_file_loc").notNull(),
    p75FileLoc: real("p75_file_loc").default(0).notNull(),
    p90FileLoc: real("p90_file_loc").default(0).notNull(),
    p95FileLoc: real("p95_file_loc").notNull(),
    maxFileLoc: integer("max_file_loc").notNull(),
    filesOver500Loc: integer("files_over_500_loc").notNull(),
    filesOver1000Loc: integer("files_over_1000_loc").notNull(),
    filesOver2000Loc: integer("files_over_2000_loc").notNull(),
    directoryCount: integer("directory_count").notNull(),
    medianDirectoryDepth: real("median_directory_depth").default(0).notNull(),
    p95DirectoryDepth: real("p95_directory_depth").notNull(),
    maxDirectoryDepth: integer("max_directory_depth").notNull(),
    packageCount: integer("package_count").notNull(),
    testFileCount: integer("test_file_count").notNull(),
    testToSourceRatio: real("test_to_source_ratio").notNull(),
    documentationFileCount: integer("documentation_file_count").notNull(),
    claudeMdCount: integer("claude_md_count").notNull(),
    claudeMdTotalBytes: bigint("claude_md_total_bytes", {
      mode: "number",
    }).notNull(),
    agentsMdCount: integer("agents_md_count").default(0).notNull(),
    agentsMdTotalBytes: bigint("agents_md_total_bytes", { mode: "number" })
      .default(0)
      .notNull(),
    generatedFileCount: integer("generated_file_count").notNull(),
    generatedFileBytes: bigint("generated_file_bytes", {
      mode: "number",
    }).notNull(),
    dependencyGraphNodes: integer("dependency_graph_nodes").notNull(),
    dependencyGraphEdges: integer("dependency_graph_edges").notNull(),
    meanFanOut: real("mean_fan_out").notNull(),
    p95FanOut: real("p95_fan_out").notNull(),
    meanFanIn: real("mean_fan_in").notNull(),
    p95FanIn: real("p95_fan_in").notNull(),
    maxFanIn: integer("max_fan_in").default(0).notNull(),
    maxFanOut: integer("max_fan_out").default(0).notNull(),
    dependencyCycleCount: integer("dependency_cycle_count").notNull(),
    crossModuleEdgeCount: integer("cross_module_edge_count").default(0).notNull(),
    crossModuleEdgeRatio: real("cross_module_edge_ratio").notNull(),
    languageDistributionJson: jsonb("language_distribution_json").notNull(),
  },
  (t) => [
    uniqueIndex("snapshot_repo_fingerprint_uq").on(
      t.repositoryId,
      t.fingerprint,
    ),
    index("snapshot_repository_idx").on(t.repositoryId),
  ],
);

export const repoSnapshotFiles = pgTable(
  "repo_snapshot_files",
  {
    id: id(),
    snapshotId: uuid("snapshot_id")
      .references(() => repoSnapshots.id, { onDelete: "cascade" })
      .notNull(),
    path: text("path").notNull(),
    language: text("language").notNull(),
    extension: text("extension").notNull(),
    bytes: integer("bytes").notNull(),
    loc: integer("loc").notNull(),
    directoryDepth: integer("directory_depth").notNull(),
    moduleName: text("module_name").notNull(),
    isTest: boolean("is_test").notNull(),
    isGenerated: boolean("is_generated").notNull(),
    isDocumentation: boolean("is_documentation").notNull(),
    dependencyFanIn: integer("dependency_fan_in").notNull(),
    dependencyFanOut: integer("dependency_fan_out").notNull(),
    crossModuleDependencies: integer("cross_module_dependencies").notNull(),
    inDependencyCycle: boolean("in_dependency_cycle").notNull(),
  },
  (t) => [
    uniqueIndex("snapshot_file_uq").on(t.snapshotId, t.path),
    index("snapshot_file_snapshot_idx").on(t.snapshotId),
  ],
);

export const prompts = pgTable(
  "prompts",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    provider: text("provider").default("claude").notNull(),
    externalPromptId: text("external_prompt_id").notNull(),
    sessionId: text("session_id"),
    developerId: uuid("developer_id").references(() => developers.id),
    repositoryId: uuid("repository_id").references(() => repositories.id),
    snapshotId: uuid("snapshot_id").references(() => repoSnapshots.id),
    promptLength: integer("prompt_length"),
    promptText: text("prompt_text"),
    model: text("model"),
    branch: text("branch"),
    headSha: text("head_sha"),
    dirty: boolean("dirty"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    hookReceivedAt: timestamp("hook_received_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("prompt_workspace_provider_external_uq").on(
      t.workspaceId,
      t.provider,
      t.externalPromptId,
    ),
    index("prompt_session_idx").on(t.sessionId),
    index("prompt_repository_idx").on(t.repositoryId),
    index("prompt_started_idx").on(t.startedAt),
    index("prompt_provider_idx").on(t.provider),
  ],
);

export const apiRequests = pgTable(
  "api_requests",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    promptId: uuid("prompt_id")
      .references(() => prompts.id, { onDelete: "cascade" })
      .notNull(),
    eventSequence: text("event_sequence").notNull(),
    requestId: text("request_id"),
    model: text("model"),
    querySource: text("query_source"),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    cacheReadTokens: integer("cache_read_tokens").default(0).notNull(),
    cacheCreationTokens: integer("cache_creation_tokens").default(0).notNull(),
    costUsd: numeric("cost_usd", { precision: 14, scale: 6 }),
    durationMs: integer("duration_ms").default(0).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("api_event_uq").on(t.workspaceId, t.promptId, t.eventSequence),
    index("api_prompt_idx").on(t.promptId),
    index("api_timestamp_idx").on(t.timestamp),
  ],
);

export const toolEvents = pgTable(
  "tool_events",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    promptId: uuid("prompt_id")
      .references(() => prompts.id, { onDelete: "cascade" })
      .notNull(),
    toolUseId: text("tool_use_id").notNull(),
    toolName: text("tool_name"),
    success: boolean("success"),
    durationMs: integer("duration_ms"),
    toolInputSizeBytes: integer("tool_input_size_bytes"),
    toolResultSizeBytes: integer("tool_result_size_bytes"),
    relativeFilePath: text("relative_file_path"),
    timestamp: timestamp("timestamp", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("tool_event_uq").on(t.workspaceId, t.promptId, t.toolUseId),
    index("tool_prompt_idx").on(t.promptId),
  ],
);
