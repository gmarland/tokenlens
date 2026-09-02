import type { MigrationInterface, QueryRunner } from "typeorm";

export class InstructionFingerprint2026090100040 implements MigrationInterface {
  name = "InstructionFingerprint2026090100040";

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`ALTER TABLE repo_snapshots ADD COLUMN instruction_fingerprint text`);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`ALTER TABLE repo_snapshots DROP COLUMN instruction_fingerprint`);
  }
}
