import type { MigrationInterface, QueryRunner } from "typeorm";

export class PromptBenchmarks2026090100010 implements MigrationInterface {
  name = "PromptBenchmarks2026090100010";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE prompts ADD COLUMN prompt_fingerprint text;
      UPDATE prompts
      SET prompt_fingerprint = encode(sha256(convert_to(
        replace(replace(prompt_text, E'\\r\\n', E'\\n'), E'\\r', E'\\n'),
        'UTF8'
      )), 'hex')
      WHERE prompt_text IS NOT NULL;
      CREATE INDEX prompt_benchmark_match_idx
        ON prompts(repository_id, provider, prompt_fingerprint, started_at)
        WHERE prompt_fingerprint IS NOT NULL;

      CREATE TABLE prompt_benchmarks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        source_prompt_id uuid REFERENCES prompts(id) ON DELETE SET NULL,
        name text NOT NULL,
        provider text NOT NULL,
        model text NOT NULL,
        prompt_text text NOT NULL,
        prompt_fingerprint text NOT NULL,
        matcher_version integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        archived_at timestamptz
      );
      CREATE INDEX prompt_benchmark_repository_idx ON prompt_benchmarks(repository_id);
      CREATE UNIQUE INDEX prompt_benchmark_active_match_uq
        ON prompt_benchmarks(repository_id, provider, model, prompt_fingerprint)
        WHERE archived_at IS NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE prompt_benchmarks;
      DROP INDEX prompt_benchmark_match_idx;
      ALTER TABLE prompts DROP COLUMN prompt_fingerprint;
    `);
  }
}
