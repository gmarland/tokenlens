import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema2026082900000 implements MigrationInterface {
  name = "InitialSchema2026082900000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE workspaces (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, ingest_key_hash text NOT NULL UNIQUE, capture_prompts boolean NOT NULL DEFAULT false, is_demo boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE developers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, provider text NOT NULL DEFAULT 'claude', external_id text, email text, first_seen_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX developer_workspace_idx ON developers(workspace_id);
      CREATE UNIQUE INDEX developer_workspace_provider_external_uq ON developers(workspace_id, provider, external_id);
      CREATE TABLE repositories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, repo_key text NOT NULL, name text NOT NULL, remote_host text, remote_owner text, remote_name text, created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now());
      CREATE UNIQUE INDEX repository_workspace_key_uq ON repositories(workspace_id, repo_key);
      CREATE TABLE repo_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        fingerprint text NOT NULL, head_sha text NOT NULL, branch text NOT NULL, dirty boolean NOT NULL, captured_at timestamptz NOT NULL,
        tracked_files integer NOT NULL, source_files integer NOT NULL, total_source_loc bigint NOT NULL, median_file_loc real NOT NULL,
        p75_file_loc real NOT NULL DEFAULT 0, p90_file_loc real NOT NULL DEFAULT 0, p95_file_loc real NOT NULL, max_file_loc integer NOT NULL,
        files_over_500_loc integer NOT NULL, files_over_1000_loc integer NOT NULL, files_over_2000_loc integer NOT NULL,
        directory_count integer NOT NULL, median_directory_depth real NOT NULL DEFAULT 0, p95_directory_depth real NOT NULL,
        max_directory_depth integer NOT NULL, package_count integer NOT NULL, test_file_count integer NOT NULL, test_to_source_ratio real NOT NULL,
        documentation_file_count integer NOT NULL, claude_md_count integer NOT NULL, claude_md_total_bytes bigint NOT NULL,
        agents_md_count integer NOT NULL DEFAULT 0, agents_md_total_bytes bigint NOT NULL DEFAULT 0,
        generated_file_count integer NOT NULL, generated_file_bytes bigint NOT NULL, dependency_graph_nodes integer NOT NULL,
        dependency_graph_edges integer NOT NULL, mean_fan_out real NOT NULL, p95_fan_out real NOT NULL, mean_fan_in real NOT NULL,
        p95_fan_in real NOT NULL, max_fan_in integer NOT NULL DEFAULT 0, max_fan_out integer NOT NULL DEFAULT 0,
        dependency_cycle_count integer NOT NULL, cross_module_edge_count integer NOT NULL DEFAULT 0,
        cross_module_edge_ratio real NOT NULL, language_distribution_json jsonb NOT NULL
      );
      CREATE UNIQUE INDEX snapshot_repo_fingerprint_uq ON repo_snapshots(repository_id, fingerprint);
      CREATE INDEX snapshot_repository_idx ON repo_snapshots(repository_id);
      CREATE TABLE repo_snapshot_files (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), snapshot_id uuid NOT NULL REFERENCES repo_snapshots(id) ON DELETE CASCADE, path text NOT NULL, language text NOT NULL, extension text NOT NULL, bytes integer NOT NULL, loc integer NOT NULL, directory_depth integer NOT NULL, module_name text NOT NULL, is_test boolean NOT NULL, is_generated boolean NOT NULL, is_documentation boolean NOT NULL, dependency_fan_in integer NOT NULL, dependency_fan_out integer NOT NULL, cross_module_dependencies integer NOT NULL, in_dependency_cycle boolean NOT NULL);
      CREATE UNIQUE INDEX snapshot_file_uq ON repo_snapshot_files(snapshot_id, path);
      CREATE INDEX snapshot_file_snapshot_idx ON repo_snapshot_files(snapshot_id);
      CREATE TABLE prompts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, provider text NOT NULL DEFAULT 'claude', external_prompt_id text NOT NULL, session_id text, developer_id uuid REFERENCES developers(id), repository_id uuid REFERENCES repositories(id), snapshot_id uuid REFERENCES repo_snapshots(id), prompt_length integer, prompt_text text, model text, branch text, head_sha text, dirty boolean, started_at timestamptz, hook_received_at timestamptz);
      CREATE UNIQUE INDEX prompt_workspace_provider_external_uq ON prompts(workspace_id, provider, external_prompt_id);
      CREATE INDEX prompt_session_idx ON prompts(session_id); CREATE INDEX prompt_repository_idx ON prompts(repository_id); CREATE INDEX prompt_started_idx ON prompts(started_at); CREATE INDEX prompt_provider_idx ON prompts(provider);
      CREATE TABLE api_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, prompt_id uuid NOT NULL REFERENCES prompts(id) ON DELETE CASCADE, event_sequence text NOT NULL, request_id text, model text, query_source text, input_tokens integer NOT NULL DEFAULT 0, output_tokens integer NOT NULL DEFAULT 0, cache_read_tokens integer NOT NULL DEFAULT 0, cache_creation_tokens integer NOT NULL DEFAULT 0, cost_usd numeric(14,6), duration_ms integer NOT NULL DEFAULT 0, timestamp timestamptz NOT NULL);
      CREATE UNIQUE INDEX api_event_uq ON api_requests(workspace_id, prompt_id, event_sequence); CREATE INDEX api_prompt_idx ON api_requests(prompt_id); CREATE INDEX api_timestamp_idx ON api_requests(timestamp);
      CREATE TABLE tool_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, prompt_id uuid NOT NULL REFERENCES prompts(id) ON DELETE CASCADE, tool_use_id text NOT NULL, tool_name text, success boolean, duration_ms integer, tool_input_size_bytes integer, tool_result_size_bytes integer, relative_file_path text, timestamp timestamptz);
      CREATE UNIQUE INDEX tool_event_uq ON tool_events(workspace_id, prompt_id, tool_use_id); CREATE INDEX tool_prompt_idx ON tool_events(prompt_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE tool_events; DROP TABLE api_requests; DROP TABLE prompts; DROP TABLE repo_snapshot_files; DROP TABLE repo_snapshots; DROP TABLE repositories; DROP TABLE developers; DROP TABLE workspaces;`);
  }
}
