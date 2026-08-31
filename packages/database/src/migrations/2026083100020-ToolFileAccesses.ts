import type { MigrationInterface, QueryRunner } from "typeorm";

export class ToolFileAccesses2026083100020 implements MigrationInterface {
  name = "ToolFileAccesses2026083100020";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tool_file_accesses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tool_event_id uuid NOT NULL REFERENCES tool_events(id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('read', 'edit')),
        relative_file_path text NOT NULL,
        attribution text NOT NULL CHECK (attribution IN ('explicit_tool', 'structured_action', 'shell_operand'))
      );
      CREATE UNIQUE INDEX tool_file_access_uq
        ON tool_file_accesses(tool_event_id, kind, relative_file_path);
      CREATE INDEX tool_file_access_event_idx ON tool_file_accesses(tool_event_id);

      INSERT INTO tool_file_accesses(tool_event_id, kind, relative_file_path, attribution)
      SELECT id,
        CASE WHEN lower(tool_name) = 'read' THEN 'read' ELSE 'edit' END,
        relative_file_path,
        'explicit_tool'
      FROM tool_events
      WHERE relative_file_path IS NOT NULL
        AND lower(coalesce(tool_name, '')) IN ('read', 'edit', 'write', 'notebookedit', 'apply_patch');
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE tool_file_accesses`);
  }
}
