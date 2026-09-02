import { config as loadEnvironment } from "dotenv";
import { hashKey } from "./auth";
import { dataSource, db, Workspace, WorkspaceApiKey } from "./index";

loadEnvironment({ path: new URL("../../../.env", import.meta.url), quiet: true });

const database = await db();
await dataSource.runMigrations();

const ingestKey = process.env.TOKENLENS_INGEST_KEY ?? "development-key-change-me";
const workspaceRepository = database.getRepository(Workspace);
const ingestKeyHash = hashKey(ingestKey);
const existingWorkspace = await workspaceRepository.findOneBy({ ingestKeyHash });
const workspace = existingWorkspace ?? await workspaceRepository.save({
    name: process.env.TOKENLENS_WORKSPACE_NAME ?? "Local workspace",
    ingestKeyHash,
  });
await database.getRepository(WorkspaceApiKey).upsert({
  workspaceId: workspace.id,
  keyHash: ingestKeyHash,
  keyPrefix: "development",
  name: "Development key",
}, { conflictPaths: ["keyHash"], skipUpdateIfNoValuesChanged: true });

await dataSource.destroy();
console.log("Database migrations applied and ingest workspace is ready");
