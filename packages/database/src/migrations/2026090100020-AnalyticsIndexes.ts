import type { MigrationInterface, QueryRunner } from "typeorm";

export class AnalyticsIndexes2026090100020 implements MigrationInterface {
  name = "AnalyticsIndexes2026090100020";

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS prompt_repository_provider_started_idx
        ON prompts(repository_id, provider, started_at);
      CREATE INDEX IF NOT EXISTS api_prompt_model_idx
        ON api_requests(prompt_id, model);
      CREATE INDEX IF NOT EXISTS tool_file_access_kind_path_idx
        ON tool_file_accesses(kind, relative_file_path, tool_event_id);
      CREATE INDEX IF NOT EXISTS snapshot_file_snapshot_path_idx
        ON repo_snapshot_files(snapshot_id, path);
    `);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`
      DROP INDEX IF EXISTS snapshot_file_snapshot_path_idx;
      DROP INDEX IF EXISTS tool_file_access_kind_path_idx;
      DROP INDEX IF EXISTS api_prompt_model_idx;
      DROP INDEX IF EXISTS prompt_repository_provider_started_idx;
    `);
  }
}
