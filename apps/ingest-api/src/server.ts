import { config as loadEnvironment } from "dotenv";
import { dataSource } from "@tokenlens/database";
import { buildApp } from "./app";

loadEnvironment({ path: new URL("../../../.env", import.meta.url), quiet: true });

function portFromEnvironment(value: string | undefined) {
  const port = Number(value ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

const app = buildApp(undefined, { logger: true });
const port = portFromEnvironment(process.env.INGEST_API_PORT ?? process.env.PORT);
const host = process.env.INGEST_API_HOST ?? process.env.HOST ?? "0.0.0.0";

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down ingestion API");
  await app.close();
  if (dataSource.isInitialized) await dataSource.destroy();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
