import type { MigrationInterface, QueryRunner } from "typeorm";

export class ReconcileCodexUsage2026083000030 implements MigrationInterface {
  name = "ReconcileCodexUsage2026083000030";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH candidates AS (
        SELECT event.id event_id, target.id target_prompt_id
        FROM api_requests event
        JOIN prompts stub ON stub.id = event.prompt_id
        JOIN LATERAL (
          SELECT prompt.id
          FROM prompts prompt
          WHERE prompt.workspace_id = stub.workspace_id
            AND prompt.provider = 'codex'
            AND prompt.session_id = stub.session_id
            AND prompt.hook_received_at IS NOT NULL
            AND prompt.started_at <= event.timestamp
          ORDER BY prompt.started_at DESC
          LIMIT 1
        ) target ON true
        WHERE stub.provider = 'codex'
          AND stub.hook_received_at IS NULL
      )
      DELETE FROM api_requests duplicate
      USING candidates
      WHERE duplicate.id = candidates.event_id
        AND EXISTS (
          SELECT 1 FROM api_requests existing
          WHERE existing.workspace_id = duplicate.workspace_id
            AND existing.prompt_id = candidates.target_prompt_id
            AND existing.event_sequence = duplicate.event_sequence
            AND existing.id <> duplicate.id
        );

      WITH candidates AS (
        SELECT event.id event_id, target.id target_prompt_id
        FROM api_requests event
        JOIN prompts stub ON stub.id = event.prompt_id
        JOIN LATERAL (
          SELECT prompt.id
          FROM prompts prompt
          WHERE prompt.workspace_id = stub.workspace_id
            AND prompt.provider = 'codex'
            AND prompt.session_id = stub.session_id
            AND prompt.hook_received_at IS NOT NULL
            AND prompt.started_at <= event.timestamp
          ORDER BY prompt.started_at DESC
          LIMIT 1
        ) target ON true
        WHERE stub.provider = 'codex'
          AND stub.hook_received_at IS NULL
      )
      UPDATE api_requests event
      SET prompt_id = candidates.target_prompt_id
      FROM candidates
      WHERE event.id = candidates.event_id;

      WITH candidates AS (
        SELECT event.id event_id, target.id target_prompt_id
        FROM tool_events event
        JOIN prompts stub ON stub.id = event.prompt_id
        JOIN LATERAL (
          SELECT prompt.id
          FROM prompts prompt
          WHERE prompt.workspace_id = stub.workspace_id
            AND prompt.provider = 'codex'
            AND prompt.session_id = stub.session_id
            AND prompt.hook_received_at IS NOT NULL
            AND prompt.started_at <= event.timestamp
          ORDER BY prompt.started_at DESC
          LIMIT 1
        ) target ON true
        WHERE stub.provider = 'codex'
          AND stub.hook_received_at IS NULL
      )
      DELETE FROM tool_events duplicate
      USING candidates
      WHERE duplicate.id = candidates.event_id
        AND EXISTS (
          SELECT 1 FROM tool_events existing
          WHERE existing.workspace_id = duplicate.workspace_id
            AND existing.prompt_id = candidates.target_prompt_id
            AND existing.tool_use_id = duplicate.tool_use_id
            AND existing.id <> duplicate.id
        );

      WITH candidates AS (
        SELECT event.id event_id, target.id target_prompt_id
        FROM tool_events event
        JOIN prompts stub ON stub.id = event.prompt_id
        JOIN LATERAL (
          SELECT prompt.id
          FROM prompts prompt
          WHERE prompt.workspace_id = stub.workspace_id
            AND prompt.provider = 'codex'
            AND prompt.session_id = stub.session_id
            AND prompt.hook_received_at IS NOT NULL
            AND prompt.started_at <= event.timestamp
          ORDER BY prompt.started_at DESC
          LIMIT 1
        ) target ON true
        WHERE stub.provider = 'codex'
          AND stub.hook_received_at IS NULL
      )
      UPDATE tool_events event
      SET prompt_id = candidates.target_prompt_id
      FROM candidates
      WHERE event.id = candidates.event_id;

      DELETE FROM prompts stub
      WHERE stub.provider = 'codex'
        AND stub.hook_received_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM api_requests WHERE prompt_id = stub.id)
        AND NOT EXISTS (SELECT 1 FROM tool_events WHERE prompt_id = stub.id);
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      "ReconcileCodexUsage2026083000030 is forward-only because prompt attribution cannot be safely undone",
    );
  }
}
