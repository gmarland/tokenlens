CREATE TABLE "api_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"event_sequence" text NOT NULL,
	"request_id" text,
	"model" text,
	"query_source" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_creation_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(14, 6) DEFAULT '0' NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"anthropic_account_id" text,
	"anthropic_account_uuid" text,
	"anthropic_anonymous_id" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"claude_prompt_id" text NOT NULL,
	"session_id" text,
	"developer_id" uuid,
	"repository_id" uuid,
	"snapshot_id" uuid,
	"prompt_length" integer,
	"prompt_text" text,
	"branch" text,
	"head_sha" text,
	"dirty" boolean,
	"started_at" timestamp with time zone,
	"hook_received_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "repo_snapshot_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"path" text NOT NULL,
	"language" text NOT NULL,
	"extension" text NOT NULL,
	"bytes" integer NOT NULL,
	"loc" integer NOT NULL,
	"directory_depth" integer NOT NULL,
	"module_name" text NOT NULL,
	"is_test" boolean NOT NULL,
	"is_generated" boolean NOT NULL,
	"is_documentation" boolean NOT NULL,
	"dependency_fan_in" integer NOT NULL,
	"dependency_fan_out" integer NOT NULL,
	"cross_module_dependencies" integer NOT NULL,
	"in_dependency_cycle" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"head_sha" text NOT NULL,
	"branch" text NOT NULL,
	"dirty" boolean NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"tracked_files" integer NOT NULL,
	"source_files" integer NOT NULL,
	"total_source_loc" bigint NOT NULL,
	"median_file_loc" real NOT NULL,
	"p75_file_loc" real DEFAULT 0 NOT NULL,
	"p90_file_loc" real DEFAULT 0 NOT NULL,
	"p95_file_loc" real NOT NULL,
	"max_file_loc" integer NOT NULL,
	"files_over_500_loc" integer NOT NULL,
	"files_over_1000_loc" integer NOT NULL,
	"files_over_2000_loc" integer NOT NULL,
	"directory_count" integer NOT NULL,
	"median_directory_depth" real DEFAULT 0 NOT NULL,
	"p95_directory_depth" real NOT NULL,
	"max_directory_depth" integer NOT NULL,
	"package_count" integer NOT NULL,
	"test_file_count" integer NOT NULL,
	"test_to_source_ratio" real NOT NULL,
	"documentation_file_count" integer NOT NULL,
	"claude_md_count" integer NOT NULL,
	"claude_md_total_bytes" bigint NOT NULL,
	"generated_file_count" integer NOT NULL,
	"generated_file_bytes" bigint NOT NULL,
	"dependency_graph_nodes" integer NOT NULL,
	"dependency_graph_edges" integer NOT NULL,
	"mean_fan_out" real NOT NULL,
	"p95_fan_out" real NOT NULL,
	"mean_fan_in" real NOT NULL,
	"p95_fan_in" real NOT NULL,
	"max_fan_in" integer DEFAULT 0 NOT NULL,
	"max_fan_out" integer DEFAULT 0 NOT NULL,
	"dependency_cycle_count" integer NOT NULL,
	"cross_module_edge_count" integer DEFAULT 0 NOT NULL,
	"cross_module_edge_ratio" real NOT NULL,
	"language_distribution_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"repo_key" text NOT NULL,
	"name" text NOT NULL,
	"remote_host" text,
	"remote_owner" text,
	"remote_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"tool_use_id" text NOT NULL,
	"tool_name" text,
	"success" boolean,
	"duration_ms" integer,
	"tool_input_size_bytes" integer,
	"tool_result_size_bytes" integer,
	"relative_file_path" text,
	"timestamp" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"ingest_key_hash" text NOT NULL,
	"capture_prompts" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_ingest_key_hash_unique" UNIQUE("ingest_key_hash")
);
--> statement-breakpoint
ALTER TABLE "api_requests" ADD CONSTRAINT "api_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_requests" ADD CONSTRAINT "api_requests_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developers" ADD CONSTRAINT "developers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_snapshot_id_repo_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."repo_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_snapshot_files" ADD CONSTRAINT "repo_snapshot_files_snapshot_id_repo_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."repo_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_snapshots" ADD CONSTRAINT "repo_snapshots_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_events" ADD CONSTRAINT "tool_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_events" ADD CONSTRAINT "tool_events_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_event_uq" ON "api_requests" USING btree ("workspace_id","prompt_id","event_sequence");--> statement-breakpoint
CREATE INDEX "api_prompt_idx" ON "api_requests" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "api_timestamp_idx" ON "api_requests" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "developer_workspace_idx" ON "developers" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_workspace_claude_uq" ON "prompts" USING btree ("workspace_id","claude_prompt_id");--> statement-breakpoint
CREATE INDEX "prompt_session_idx" ON "prompts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "prompt_repository_idx" ON "prompts" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "prompt_started_idx" ON "prompts" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshot_file_uq" ON "repo_snapshot_files" USING btree ("snapshot_id","path");--> statement-breakpoint
CREATE INDEX "snapshot_file_snapshot_idx" ON "repo_snapshot_files" USING btree ("snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshot_repo_fingerprint_uq" ON "repo_snapshots" USING btree ("repository_id","fingerprint");--> statement-breakpoint
CREATE INDEX "snapshot_repository_idx" ON "repo_snapshots" USING btree ("repository_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repository_workspace_key_uq" ON "repositories" USING btree ("workspace_id","repo_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_event_uq" ON "tool_events" USING btree ("workspace_id","tool_use_id");--> statement-breakpoint
CREATE INDEX "tool_prompt_idx" ON "tool_events" USING btree ("prompt_id");