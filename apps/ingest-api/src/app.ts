import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { ZodError } from "zod";
import {
  promptHookSchema,
  snapshotSchema,
  toolHookSchema,
  type PromptHook,
  type SnapshotUpload,
  type ToolHook,
} from "@tokenlens/shared";
import { authenticate as databaseAuthenticate } from "@tokenlens/database/auth";
import { db } from "@tokenlens/database";
import {
  ingestOtel as databaseIngestOtel,
  ingestPrompt as databaseIngestPrompt,
  ingestSnapshot as databaseIngestSnapshot,
  ingestTool as databaseIngestTool,
} from "@tokenlens/database/services";
import {
  parseOtlp as parseOpenTelemetry,
  type NormalizedAgentEvent,
} from "@tokenlens/otel-parser";

type WorkspaceIdentity = { id: string; name: string };

export type IngestApiDependencies = {
  authenticate(header: string | null): Promise<WorkspaceIdentity | null>;
  checkDatabase(): Promise<void>;
  ingestPrompt(workspaceId: string, input: PromptHook): Promise<unknown>;
  ingestTool(workspaceId: string, input: ToolHook): Promise<unknown>;
  ingestSnapshot(workspaceId: string, input: SnapshotUpload): Promise<{ id: string }>;
  parseOtlp(body: unknown): NormalizedAgentEvent[];
  ingestOtel(workspaceId: string, events: NormalizedAgentEvent[]): Promise<unknown>;
};

const productionDependencies: IngestApiDependencies = {
  authenticate: databaseAuthenticate,
  async checkDatabase() {
    await (await db()).query("select 1");
  },
  ingestPrompt: databaseIngestPrompt,
  ingestTool: databaseIngestTool,
  ingestSnapshot: databaseIngestSnapshot,
  parseOtlp: parseOpenTelemetry,
  ingestOtel: databaseIngestOtel,
};

async function workspaceFor(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: IngestApiDependencies,
) {
  const authorization = request.headers.authorization;
  const workspace = await dependencies.authenticate(
    Array.isArray(authorization) ? authorization[0] ?? null : authorization ?? null,
  );
  if (!workspace) {
    await reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return workspace;
}

export function buildApp(
  dependencies: IngestApiDependencies = productionDependencies,
  options: { logger?: boolean } = {},
): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  app.setErrorHandler((error, request, reply) => {
    const httpError = error as { code?: string; statusCode?: number };
    if (httpError.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return reply.code(413).send({ error: "payload too large" });
    }
    if (error instanceof ZodError || error instanceof SyntaxError || httpError.statusCode === 400) {
      return reply.code(400).send({ error: "invalid payload" });
    }
    request.log.error({ err: error }, "Ingestion request failed");
    return reply.code(500).send({ error: "internal server error" });
  });

  app.get("/health/live", async () => ({ ok: true }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await dependencies.checkDatabase();
      return { ok: true, database: "healthy" };
    } catch {
      return reply.code(503).send({ ok: false, database: "unavailable" });
    }
  });
  app.get("/api/health", async (request, reply) => {
    const workspace = await workspaceFor(request, reply, dependencies);
    if (!workspace) return;
    await dependencies.checkDatabase();
    return { ok: true, database: "healthy", workspace: workspace.name };
  });

  app.post(
    "/api/ingest/prompt",
    { bodyLimit: 64_000 },
    async (request, reply) => {
      const workspace = await workspaceFor(request, reply, dependencies);
      if (!workspace) return;
      return dependencies.ingestPrompt(workspace.id, promptHookSchema.parse(request.body));
    },
  );

  app.post(
    "/api/ingest/tool",
    { bodyLimit: 64_000 },
    async (request, reply) => {
      const workspace = await workspaceFor(request, reply, dependencies);
      if (!workspace) return;
      await dependencies.ingestTool(workspace.id, toolHookSchema.parse(request.body));
      return { accepted: true };
    },
  );

  app.post(
    "/api/ingest/snapshot",
    { bodyLimit: 20_000_000 },
    async (request, reply) => {
      const workspace = await workspaceFor(request, reply, dependencies);
      if (!workspace) return;
      const snapshot = await dependencies.ingestSnapshot(
        workspace.id,
        snapshotSchema.parse(request.body),
      );
      return { id: snapshot.id };
    },
  );

  app.post(
    "/api/ingest/otel/v1/logs",
    { bodyLimit: 5_000_000 },
    async (request, reply) => {
      const workspace = await workspaceFor(request, reply, dependencies);
      if (!workspace) return;
      const events = dependencies.parseOtlp(request.body);
      await dependencies.ingestOtel(workspace.id, events);
      return { partialSuccess: { rejectedLogRecords: 0 } };
    },
  );

  return app;
}
