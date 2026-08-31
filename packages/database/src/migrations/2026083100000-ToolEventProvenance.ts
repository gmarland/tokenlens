import type { MigrationInterface, QueryRunner } from "typeorm";

export class ToolEventProvenance2026083100000 implements MigrationInterface {
  name = "ToolEventProvenance2026083100000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tool_events
      ADD COLUMN ingest_source text NOT NULL DEFAULT 'unknown';

      UPDATE tool_events event
      SET ingest_source = CASE
        WHEN event.tool_use_id LIKE 'call\\_%' ESCAPE '\\' THEN 'otel'
        WHEN event.tool_use_id LIKE 'exec-%' THEN 'hook'
        WHEN event.tool_name IN ('exec', 'apply_patch', 'update_plan', 'write_stdin') THEN 'otel'
        WHEN event.tool_name IN ('Bash', 'exec_command', 'Edit', 'Write', 'NotebookEdit', 'Read') THEN 'hook'
        ELSE 'unknown'
      END
      FROM prompts prompt
      WHERE prompt.id = event.prompt_id AND prompt.provider = 'codex';

      UPDATE tool_events event
      SET tool_input_size_bytes = NULLIF(event.tool_input_size_bytes, 0),
          tool_result_size_bytes = NULLIF(event.tool_result_size_bytes, 0)
      FROM prompts prompt
      WHERE prompt.id = event.prompt_id
        AND prompt.provider = 'codex'
        AND event.ingest_source = 'otel';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tool_events DROP COLUMN ingest_source`);
  }
}
