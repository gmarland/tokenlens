import "reflect-metadata";
import { DataSource } from "typeorm";
import { entities } from "./entities";
import { InitialSchema2026082900000 } from "./migrations/2026082900000-InitialSchema";
import { AlwaysCapturePrompts2026083000000 } from "./migrations/2026083000000-AlwaysCapturePrompts";
import { UpgradeLegacySchema2026083000010 } from "./migrations/2026083000010-UpgradeLegacySchema";
import { RemoveDemoData2026083000020 } from "./migrations/2026083000020-RemoveDemoData";
import { ReconcileCodexUsage2026083000030 } from "./migrations/2026083000030-ReconcileCodexUsage";
import { ToolEventProvenance2026083100000 } from "./migrations/2026083100000-ToolEventProvenance";
import { CacheMetricAvailability2026083100010 } from "./migrations/2026083100010-CacheMetricAvailability";
import { ToolFileAccesses2026083100020 } from "./migrations/2026083100020-ToolFileAccesses";
import { RepoCommits2026083100030 } from "./migrations/2026083100030-RepoCommits";

export const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL ?? "postgres://tokenlens:tokenlens@localhost:5432/tokenlens",
  // PostgreSQL stores timestamptz values as UTC instants, while the session
  // timezone controls their input interpretation and output representation.
  // Pin every application and migration connection so both are consistently UTC.
  extra: { options: "-c timezone=UTC" },
  entities,
  migrations: [
    InitialSchema2026082900000,
    AlwaysCapturePrompts2026083000000,
    UpgradeLegacySchema2026083000010,
    RemoveDemoData2026083000020,
    ReconcileCodexUsage2026083000030,
    ToolEventProvenance2026083100000,
    CacheMetricAvailability2026083100010,
    ToolFileAccesses2026083100020,
    RepoCommits2026083100030,
  ],
  migrationsRun: false,
  migrationsTableName: "typeorm_migrations",
  synchronize: false,
});

let initialization: Promise<DataSource> | undefined;

export function db(): Promise<DataSource> {
  if (dataSource.isInitialized) return Promise.resolve(dataSource);
  initialization ??= dataSource.initialize().catch((error) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

export * from "./entities";
