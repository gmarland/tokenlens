import type { MigrationInterface, QueryRunner } from "typeorm";

export class PromptSearchIndex2026090100000 implements MigrationInterface {
  name = "PromptSearchIndex2026090100000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS prompt_text_trgm_idx
      ON prompts USING gin (prompt_text gin_trgm_ops)
      WHERE prompt_text IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP INDEX IF EXISTS prompt_text_trgm_idx");
  }
}
