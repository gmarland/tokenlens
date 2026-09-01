import type { MigrationInterface, QueryRunner } from "typeorm";

export class InsightStates2026090100030 implements MigrationInterface {
  name = "InsightStates2026090100030";

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`
      CREATE TABLE insight_states (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        insight_id text NOT NULL,
        state text NOT NULL DEFAULT 'new' CHECK (state IN ('new','acknowledged','monitoring','dismissed','resolved')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX insight_state_repository_insight_uq ON insight_states(repository_id, insight_id);
    `);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`DROP TABLE insight_states`);
  }
}
