import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

const bigintNumber = {
  from: (value: string | number) => Number(value),
  to: (value: number) => value,
};

@Entity("workspaces")
export class Workspace {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column("text") name!: string;
  @Column("text", { name: "ingest_key_hash", unique: true }) ingestKeyHash!: string;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}

@Entity("developers")
@Index("developer_workspace_idx", ["workspaceId"])
@Index("developer_workspace_provider_external_uq", ["workspaceId", "provider", "externalId"], { unique: true })
export class Developer {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column("uuid", { name: "workspace_id" }) workspaceId!: string;
  @Column("text", { default: "claude" }) provider!: string;
  @Column("text", { name: "external_id", nullable: true }) externalId!: string | null;
  @Column("text", { nullable: true }) email!: string | null;
  @CreateDateColumn({ name: "first_seen_at", type: "timestamptz" }) firstSeenAt!: Date;
  @CreateDateColumn({ name: "last_seen_at", type: "timestamptz" }) lastSeenAt!: Date;
}

@Entity("repositories")
@Index("repository_workspace_key_uq", ["workspaceId", "repoKey"], { unique: true })
export class Repository {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column("uuid", { name: "workspace_id" }) workspaceId!: string;
  @Column("text", { name: "repo_key" }) repoKey!: string;
  @Column("text") name!: string;
  @Column("text", { name: "remote_host", nullable: true }) remoteHost!: string | null;
  @Column("text", { name: "remote_owner", nullable: true }) remoteOwner!: string | null;
  @Column("text", { name: "remote_name", nullable: true }) remoteName!: string | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
  @CreateDateColumn({ name: "last_seen_at", type: "timestamptz" }) lastSeenAt!: Date;
}

@Entity("repo_snapshots")
@Index("snapshot_repo_fingerprint_uq", ["repositoryId", "fingerprint"], { unique: true })
@Index("snapshot_repository_idx", ["repositoryId"])
export class RepoSnapshot {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column("uuid", { name: "repository_id" }) repositoryId!: string;
  @Column("text") fingerprint!: string;
  @Column("text", { name: "head_sha" }) headSha!: string;
  @Column("text") branch!: string;
  @Column("boolean") dirty!: boolean;
  @Column("timestamptz", { name: "captured_at" }) capturedAt!: Date;
  @Column("integer", { name: "tracked_files" }) trackedFiles!: number;
  @Column("integer", { name: "source_files" }) sourceFiles!: number;
  @Column("bigint", { name: "total_source_loc", transformer: bigintNumber }) totalSourceLoc!: number;
  @Column("real", { name: "median_file_loc" }) medianFileLoc!: number;
  @Column("real", { name: "p75_file_loc", default: 0 }) p75FileLoc!: number;
  @Column("real", { name: "p90_file_loc", default: 0 }) p90FileLoc!: number;
  @Column("real", { name: "p95_file_loc" }) p95FileLoc!: number;
  @Column("integer", { name: "max_file_loc" }) maxFileLoc!: number;
  @Column("integer", { name: "files_over_500_loc" }) filesOver500Loc!: number;
  @Column("integer", { name: "files_over_1000_loc" }) filesOver1000Loc!: number;
  @Column("integer", { name: "files_over_2000_loc" }) filesOver2000Loc!: number;
  @Column("integer", { name: "directory_count" }) directoryCount!: number;
  @Column("real", { name: "median_directory_depth", default: 0 }) medianDirectoryDepth!: number;
  @Column("real", { name: "p95_directory_depth" }) p95DirectoryDepth!: number;
  @Column("integer", { name: "max_directory_depth" }) maxDirectoryDepth!: number;
  @Column("integer", { name: "package_count" }) packageCount!: number;
  @Column("integer", { name: "test_file_count" }) testFileCount!: number;
  @Column("real", { name: "test_to_source_ratio" }) testToSourceRatio!: number;
  @Column("integer", { name: "documentation_file_count" }) documentationFileCount!: number;
  @Column("integer", { name: "claude_md_count" }) claudeMdCount!: number;
  @Column("bigint", { name: "claude_md_total_bytes", transformer: bigintNumber }) claudeMdTotalBytes!: number;
  @Column("integer", { name: "agents_md_count", default: 0 }) agentsMdCount!: number;
  @Column("bigint", { name: "agents_md_total_bytes", default: 0, transformer: bigintNumber }) agentsMdTotalBytes!: number;
  @Column("integer", { name: "generated_file_count" }) generatedFileCount!: number;
  @Column("bigint", { name: "generated_file_bytes", transformer: bigintNumber }) generatedFileBytes!: number;
  @Column("integer", { name: "dependency_graph_nodes" }) dependencyGraphNodes!: number;
  @Column("integer", { name: "dependency_graph_edges" }) dependencyGraphEdges!: number;
  @Column("real", { name: "mean_fan_out" }) meanFanOut!: number;
  @Column("real", { name: "p95_fan_out" }) p95FanOut!: number;
  @Column("real", { name: "mean_fan_in" }) meanFanIn!: number;
  @Column("real", { name: "p95_fan_in" }) p95FanIn!: number;
  @Column("integer", { name: "max_fan_in", default: 0 }) maxFanIn!: number;
  @Column("integer", { name: "max_fan_out", default: 0 }) maxFanOut!: number;
  @Column("integer", { name: "dependency_cycle_count" }) dependencyCycleCount!: number;
  @Column("integer", { name: "cross_module_edge_count", default: 0 }) crossModuleEdgeCount!: number;
  @Column("real", { name: "cross_module_edge_ratio" }) crossModuleEdgeRatio!: number;
  @Column("jsonb", { name: "language_distribution_json" }) languageDistributionJson!: Record<string, unknown>;
}

@Entity("repo_snapshot_files")
@Index("snapshot_file_uq", ["snapshotId", "path"], { unique: true })
@Index("snapshot_file_snapshot_idx", ["snapshotId"])
export class RepoSnapshotFile {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column("uuid", { name: "snapshot_id" }) snapshotId!: string;
  @Column("text") path!: string;
  @Column("text") language!: string;
  @Column("text") extension!: string;
  @Column("integer") bytes!: number;
  @Column("integer") loc!: number;
  @Column("integer", { name: "directory_depth" }) directoryDepth!: number;
  @Column("text", { name: "module_name" }) moduleName!: string;
  @Column("boolean", { name: "is_test" }) isTest!: boolean;
  @Column("boolean", { name: "is_generated" }) isGenerated!: boolean;
  @Column("boolean", { name: "is_documentation" }) isDocumentation!: boolean;
  @Column("integer", { name: "dependency_fan_in" }) dependencyFanIn!: number;
  @Column("integer", { name: "dependency_fan_out" }) dependencyFanOut!: number;
  @Column("integer", { name: "cross_module_dependencies" }) crossModuleDependencies!: number;
  @Column("boolean", { name: "in_dependency_cycle" }) inDependencyCycle!: boolean;
}

@Entity("prompts")
@Index("prompt_workspace_provider_external_uq", ["workspaceId", "provider", "externalPromptId"], { unique: true })
@Index("prompt_session_idx", ["sessionId"])
@Index("prompt_repository_idx", ["repositoryId"])
@Index("prompt_started_idx", ["startedAt"])
@Index("prompt_provider_idx", ["provider"])
export class Prompt {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column("uuid", { name: "workspace_id" }) workspaceId!: string;
  @Column("text", { default: "claude" }) provider!: string;
  @Column("text", { name: "external_prompt_id" }) externalPromptId!: string;
  @Column("text", { name: "session_id", nullable: true }) sessionId!: string | null;
  @Column("uuid", { name: "developer_id", nullable: true }) developerId!: string | null;
  @Column("uuid", { name: "repository_id", nullable: true }) repositoryId!: string | null;
  @Column("uuid", { name: "snapshot_id", nullable: true }) snapshotId!: string | null;
  @Column("integer", { name: "prompt_length", nullable: true }) promptLength!: number | null;
  @Column("text", { name: "prompt_text", nullable: true }) promptText!: string | null;
  @Column("text", { nullable: true }) model!: string | null;
  @Column("text", { nullable: true }) branch!: string | null;
  @Column("text", { name: "head_sha", nullable: true }) headSha!: string | null;
  @Column("boolean", { nullable: true }) dirty!: boolean | null;
  @Column("timestamptz", { name: "started_at", nullable: true }) startedAt!: Date | null;
  @Column("timestamptz", { name: "hook_received_at", nullable: true }) hookReceivedAt!: Date | null;
}

@Entity("api_requests")
@Index("api_event_uq", ["workspaceId", "promptId", "eventSequence"], { unique: true })
@Index("api_prompt_idx", ["promptId"])
@Index("api_timestamp_idx", ["timestamp"])
export class ApiRequest {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column("uuid", { name: "workspace_id" }) workspaceId!: string;
  @Column("uuid", { name: "prompt_id" }) promptId!: string;
  @Column("text", { name: "event_sequence" }) eventSequence!: string;
  @Column("text", { name: "request_id", nullable: true }) requestId!: string | null;
  @Column("text", { nullable: true }) model!: string | null;
  @Column("text", { name: "query_source", nullable: true }) querySource!: string | null;
  @Column("integer", { name: "input_tokens", default: 0 }) inputTokens!: number;
  @Column("integer", { name: "output_tokens", default: 0 }) outputTokens!: number;
  @Column("integer", { name: "cache_read_tokens", default: 0 }) cacheReadTokens!: number;
  @Column("integer", { name: "cache_creation_tokens", default: 0 }) cacheCreationTokens!: number;
  @Column("boolean", { name: "cache_metrics_available", default: false }) cacheMetricsAvailable!: boolean;
  @Column("numeric", { name: "cost_usd", precision: 14, scale: 6, nullable: true }) costUsd!: string | null;
  @Column("integer", { name: "duration_ms", default: 0 }) durationMs!: number;
  @Column("timestamptz") timestamp!: Date;
}

@Entity("tool_events")
@Index("tool_event_uq", ["workspaceId", "promptId", "toolUseId"], { unique: true })
@Index("tool_prompt_idx", ["promptId"])
export class ToolEvent {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column("uuid", { name: "workspace_id" }) workspaceId!: string;
  @Column("uuid", { name: "prompt_id" }) promptId!: string;
  @Column("text", { name: "tool_use_id" }) toolUseId!: string;
  @Column("text", { name: "ingest_source", default: "unknown" }) ingestSource!: string;
  @Column("text", { name: "tool_name", nullable: true }) toolName!: string | null;
  @Column("boolean", { nullable: true }) success!: boolean | null;
  @Column("integer", { name: "duration_ms", nullable: true }) durationMs!: number | null;
  @Column("integer", { name: "tool_input_size_bytes", nullable: true }) toolInputSizeBytes!: number | null;
  @Column("integer", { name: "tool_result_size_bytes", nullable: true }) toolResultSizeBytes!: number | null;
  @Column("text", { name: "relative_file_path", nullable: true }) relativeFilePath!: string | null;
  @Column("timestamptz", { nullable: true }) timestamp!: Date | null;
}

export const entities = [Workspace, Developer, Repository, RepoSnapshot, RepoSnapshotFile, Prompt, ApiRequest, ToolEvent];
