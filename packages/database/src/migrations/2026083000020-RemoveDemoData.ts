import type { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveDemoData2026083000020 implements MigrationInterface {
  name = "RemoveDemoData2026083000020";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'workspaces'
            AND column_name = 'is_demo'
        ) THEN
          DELETE FROM workspaces WHERE is_demo = true;
          ALTER TABLE workspaces DROP COLUMN is_demo;
        END IF;
      END $$;
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      "RemoveDemoData2026083000020 is forward-only because deleted demo data cannot be restored",
    );
  }
}
