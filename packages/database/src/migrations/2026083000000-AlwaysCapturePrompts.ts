import type { MigrationInterface, QueryRunner } from "typeorm";

export class AlwaysCapturePrompts2026083000000 implements MigrationInterface {
  name = "AlwaysCapturePrompts2026083000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE workspaces DROP COLUMN IF EXISTS capture_prompts",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE workspaces ADD COLUMN capture_prompts boolean NOT NULL DEFAULT false",
    );
  }
}
