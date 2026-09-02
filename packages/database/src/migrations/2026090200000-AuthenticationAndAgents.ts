import type { MigrationInterface, QueryRunner } from "typeorm";

export class AuthenticationAndAgents2026090200000 implements MigrationInterface {
  name = "AuthenticationAndAgents2026090200000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text,
        email text NOT NULL UNIQUE,
        "emailVerified" timestamptz,
        image text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX users_email_lower_uq ON users(lower(email));

      CREATE TABLE accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type text NOT NULL,
        provider text NOT NULL,
        "providerAccountId" text NOT NULL,
        refresh_token text,
        access_token text,
        expires_at bigint,
        token_type text,
        scope text,
        id_token text,
        session_state text,
        UNIQUE(provider, "providerAccountId")
      );
      CREATE INDEX accounts_user_idx ON accounts("userId");

      CREATE TABLE sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sessionToken" text NOT NULL UNIQUE,
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires timestamptz NOT NULL
      );
      CREATE INDEX sessions_user_idx ON sessions("userId");

      CREATE TABLE verification_token (
        identifier text NOT NULL,
        token text NOT NULL,
        expires timestamptz NOT NULL,
        PRIMARY KEY(identifier, token)
      );

      CREATE TABLE workspace_memberships (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role text NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'member')),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(workspace_id, user_id)
      );
      CREATE INDEX workspace_membership_user_idx ON workspace_memberships(user_id);

      CREATE TABLE workspace_api_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        key_hash text NOT NULL UNIQUE,
        key_prefix text NOT NULL,
        name text NOT NULL DEFAULT 'Default',
        created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_used_at timestamptz,
        revoked_at timestamptz
      );
      CREATE INDEX workspace_api_key_workspace_idx ON workspace_api_keys(workspace_id);
      INSERT INTO workspace_api_keys(workspace_id,key_hash,key_prefix,name)
        SELECT id,ingest_key_hash,'legacy','Legacy key' FROM workspaces
        ON CONFLICT(key_hash) DO NOTHING;

      CREATE TABLE workspace_invitations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        email text NOT NULL,
        role text NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'member')),
        token_hash text NOT NULL UNIQUE,
        invited_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL,
        accepted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX workspace_invitation_workspace_idx ON workspace_invitations(workspace_id);
      CREATE UNIQUE INDEX workspace_pending_invitation_uq ON workspace_invitations(workspace_id,lower(email)) WHERE accepted_at IS NULL;

      CREATE TABLE agent_installations (
        id uuid PRIMARY KEY,
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name text NOT NULL,
        providers text[] NOT NULL DEFAULT '{}',
        cli_version text,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz,
        revoked_at timestamptz
      );
      CREATE INDEX agent_installation_workspace_idx ON agent_installations(workspace_id);

      ALTER TABLE prompts ADD COLUMN agent_installation_id uuid REFERENCES agent_installations(id) ON DELETE SET NULL;
      ALTER TABLE tool_events ADD COLUMN agent_installation_id uuid REFERENCES agent_installations(id) ON DELETE SET NULL;
      ALTER TABLE repo_snapshots ADD COLUMN agent_installation_id uuid REFERENCES agent_installations(id) ON DELETE SET NULL;
      CREATE INDEX prompts_agent_installation_idx ON prompts(agent_installation_id);
      CREATE INDEX tool_events_agent_installation_idx ON tool_events(agent_installation_id);
      CREATE INDEX repo_snapshots_agent_installation_idx ON repo_snapshots(agent_installation_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE repo_snapshots DROP COLUMN agent_installation_id;
      ALTER TABLE tool_events DROP COLUMN agent_installation_id;
      ALTER TABLE prompts DROP COLUMN agent_installation_id;
      DROP TABLE agent_installations;
      DROP TABLE workspace_invitations;
      DROP TABLE workspace_api_keys;
      DROP TABLE workspace_memberships;
      DROP TABLE verification_token;
      DROP TABLE sessions;
      DROP TABLE accounts;
      DROP TABLE users;
    `);
  }
}
