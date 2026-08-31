import { config as loadEnvironment } from "dotenv";
import { hashKey } from "./auth";
import { dataSource, db, Workspace } from "./index";

loadEnvironment({ path: new URL("../../../.env", import.meta.url), quiet: true });

const database = await db();
await dataSource.runMigrations();

const ingestKey = process.env.TOKENLENS_INGEST_KEY ?? "development-key-change-me";
const workspaceRepository = database.getRepository(Workspace);
const ingestKeyHash = hashKey(ingestKey);
const existingWorkspace = await workspaceRepository.findOneBy({ ingestKeyHash });
if (!existingWorkspace) {
  await workspaceRepository.save({
    name: process.env.TOKENLENS_WORKSPACE_NAME ?? "Local workspace",
    ingestKeyHash,
  });
}

await dataSource.destroy();
console.log("Database migrations applied and ingest workspace is ready");
