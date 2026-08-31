import type { MigrationInterface, QueryRunner } from "typeorm";

export class CacheMetricAvailability2026083100010 implements MigrationInterface {
  name = "CacheMetricAvailability2026083100010";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE api_requests
      ADD COLUMN cache_metrics_available boolean NOT NULL DEFAULT false;

      UPDATE api_requests request
      SET cache_metrics_available = true
      FROM prompts prompt
      WHERE prompt.id = request.prompt_id
        AND prompt.provider = 'claude';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE api_requests DROP COLUMN cache_metrics_available`);
  }
}
