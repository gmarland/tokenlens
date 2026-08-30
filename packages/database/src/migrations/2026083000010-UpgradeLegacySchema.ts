import type { MigrationInterface, QueryRunner } from "typeorm";

export class UpgradeLegacySchema2026083000010 implements MigrationInterface {
  name = "UpgradeLegacySchema2026083000010";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'prompts'
            AND column_name = 'claude_prompt_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'prompts'
            AND column_name = 'external_prompt_id'
        ) THEN
          ALTER TABLE prompts RENAME COLUMN claude_prompt_id TO external_prompt_id;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'developers'
            AND column_name = 'created_at'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'developers'
            AND column_name = 'first_seen_at'
        ) THEN
          ALTER TABLE developers RENAME COLUMN created_at TO first_seen_at;
        END IF;
      END $$;

      ALTER TABLE developers ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'claude';
      ALTER TABLE developers ADD COLUMN IF NOT EXISTS external_id text;
      ALTER TABLE prompts ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'claude';
      ALTER TABLE prompts ADD COLUMN IF NOT EXISTS model text;
      ALTER TABLE repo_snapshots ADD COLUMN IF NOT EXISTS agents_md_count integer NOT NULL DEFAULT 0;
      ALTER TABLE repo_snapshots ADD COLUMN IF NOT EXISTS agents_md_total_bytes bigint NOT NULL DEFAULT 0;

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'developers'
            AND column_name = 'anthropic_account_id'
        ) THEN
          UPDATE developers
          SET external_id = coalesce(
            external_id,
            anthropic_account_uuid,
            anthropic_account_id,
            anthropic_anonymous_id,
            email
          )
          WHERE external_id IS NULL;
        END IF;
      END $$;

      UPDATE prompts p
      SET model = (
        SELECT max(a.model) FROM api_requests a WHERE a.prompt_id = p.id
      )
      WHERE p.model IS NULL;

      ALTER TABLE api_requests ALTER COLUMN cost_usd DROP DEFAULT;
      ALTER TABLE api_requests ALTER COLUMN cost_usd DROP NOT NULL;

      DROP INDEX IF EXISTS prompt_workspace_claude_uq;
      DROP INDEX IF EXISTS tool_event_uq;

      CREATE UNIQUE INDEX IF NOT EXISTS developer_workspace_provider_external_uq
        ON developers(workspace_id, provider, external_id);
      CREATE UNIQUE INDEX IF NOT EXISTS prompt_workspace_provider_external_uq
        ON prompts(workspace_id, provider, external_prompt_id);
      CREATE INDEX IF NOT EXISTS prompt_provider_idx ON prompts(provider);
      CREATE UNIQUE INDEX IF NOT EXISTS tool_event_uq
        ON tool_events(workspace_id, prompt_id, tool_use_id);

      ALTER TABLE developers DROP COLUMN IF EXISTS anthropic_account_id;
      ALTER TABLE developers DROP COLUMN IF EXISTS anthropic_account_uuid;
      ALTER TABLE developers DROP COLUMN IF EXISTS anthropic_anonymous_id;
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      "UpgradeLegacySchema2026083000010 is forward-only because reverting would lose multi-provider data",
    );
  }
}
