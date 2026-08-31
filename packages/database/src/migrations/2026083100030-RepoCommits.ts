import type { MigrationInterface, QueryRunner } from "typeorm";

export class RepoCommits2026083100030 implements MigrationInterface {
  name = "RepoCommits2026083100030";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE repo_commits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        sha text NOT NULL,
        author_name text NOT NULL,
        author_email text NOT NULL,
        authored_at timestamptz NOT NULL,
        committer_name text NOT NULL,
        committer_email text NOT NULL,
        committed_at timestamptz NOT NULL,
        observed_branch text NOT NULL,
        first_observed_at timestamptz NOT NULL
      );
      CREATE UNIQUE INDEX repo_commit_repository_sha_uq ON repo_commits(repository_id, sha);
      CREATE INDEX repo_commit_repository_committed_idx ON repo_commits(repository_id, committed_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE repo_commits`);
  }
}
