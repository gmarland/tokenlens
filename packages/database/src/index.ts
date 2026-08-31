import "reflect-metadata";
import { DataSource } from "typeorm";
import { entities } from "./entities";
import { InitialSchema2026082900000 } from "./migrations/2026082900000-InitialSchema";
import { AlwaysCapturePrompts2026083000000 } from "./migrations/2026083000000-AlwaysCapturePrompts";
import { UpgradeLegacySchema2026083000010 } from "./migrations/2026083000010-UpgradeLegacySchema";
import { RemoveDemoData2026083000020 } from "./migrations/2026083000020-RemoveDemoData";
import { ReconcileCodexUsage2026083000030 } from "./migrations/2026083000030-ReconcileCodexUsage";
import { ToolEventProvenance2026083100000 } from "./migrations/2026083100000-ToolEventProvenance";

export const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL ?? "postgres://tokenlens:tokenlens@localhost:5432/tokenlens",
  entities,
  migrations: [
    InitialSchema2026082900000,
    AlwaysCapturePrompts2026083000000,
    UpgradeLegacySchema2026083000010,
    RemoveDemoData2026083000020,
    ReconcileCodexUsage2026083000030,
    ToolEventProvenance2026083100000,
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
