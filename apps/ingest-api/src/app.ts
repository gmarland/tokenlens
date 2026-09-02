import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { z, ZodError } from "zod";
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
  registerAgent as databaseRegisterAgent,
} from "@tokenlens/database/services";
import {
  parseOtlp as parseOpenTelemetry,
  type NormalizedAgentEvent,
} from "@tokenlens/otel-parser";

type IngestIdentity = {
  workspace: { id: string; name: string };
  agent: { id: string } | null;
};

export type IngestApiDependencies = {
  authenticate(header: string | null, agentId?: string | null): Promise<IngestIdentity | null>;
  checkDatabase(): Promise<void>;
  ingestPrompt(workspaceId: string, input: PromptHook, agentId?: string): Promise<unknown>;
  ingestTool(workspaceId: string, input: ToolHook, agentId?: string): Promise<unknown>;
  ingestSnapshot(workspaceId: string, input: SnapshotUpload, agentId?: string): Promise<{ id: string }>;
  parseOtlp(body: unknown): NormalizedAgentEvent[];
  ingestOtel(workspaceId: string, events: NormalizedAgentEvent[], agentId?: string): Promise<unknown>;
  registerAgent(workspaceId: string, input: AgentRegistration): Promise<{ id: string }>;
};

const agentRegistrationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  providers: z.array(z.enum(["claude", "codex"])).min(1).max(2),
  cliVersion: z.string().trim().max(80).optional(),
});
type AgentRegistration = z.infer<typeof agentRegistrationSchema>;

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
  registerAgent: databaseRegisterAgent,
};

async function workspaceFor(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: IngestApiDependencies,
) {
  const authorization = request.headers.authorization;
  const agentHeader = request.headers["x-tokenlens-agent-id"];
  const identity = await dependencies.authenticate(
    Array.isArray(authorization) ? authorization[0] ?? null : authorization ?? null,
    Array.isArray(agentHeader) ? agentHeader[0] ?? null : agentHeader ?? null,
  );
  if (!identity) {
    await reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return identity;
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
    const identity = await workspaceFor(request, reply, dependencies);
    if (!identity) return;
    await dependencies.checkDatabase();
    return { ok: true, database: "healthy", workspace: identity.workspace.name, agent: identity.agent?.id ?? null };
  });

  app.post("/api/agents/register", { bodyLimit: 16_000 }, async (request, reply) => {
    const identity = await workspaceFor(request, reply, dependencies);
    if (!identity) return;
    try {
      const agent = await dependencies.registerAgent(
        identity.workspace.id,
        agentRegistrationSchema.parse(request.body),
      );
      return { id: agent.id, workspace: identity.workspace.name };
    } catch {
      return reply.code(403).send({ error: "agent registration rejected" });
    }
  });

  app.post(
    "/api/ingest/prompt",
    { bodyLimit: 64_000 },
    async (request, reply) => {
      const identity = await workspaceFor(request, reply, dependencies);
      if (!identity) return;
      return dependencies.ingestPrompt(identity.workspace.id, promptHookSchema.parse(request.body), identity.agent?.id);
    },
  );

  app.post(
    "/api/ingest/tool",
    { bodyLimit: 64_000 },
    async (request, reply) => {
      const identity = await workspaceFor(request, reply, dependencies);
      if (!identity) return;
      await dependencies.ingestTool(identity.workspace.id, toolHookSchema.parse(request.body), identity.agent?.id);
      return { accepted: true };
    },
  );

  app.post(
    "/api/ingest/snapshot",
    { bodyLimit: 20_000_000 },
    async (request, reply) => {
      const identity = await workspaceFor(request, reply, dependencies);
      if (!identity) return;
      const snapshot = await dependencies.ingestSnapshot(
        identity.workspace.id,
        snapshotSchema.parse(request.body),
        identity.agent?.id,
      );
      return { id: snapshot.id };
    },
  );

  app.post(
    "/api/ingest/otel/v1/logs",
    { bodyLimit: 5_000_000 },
    async (request, reply) => {
      const identity = await workspaceFor(request, reply, dependencies);
      if (!identity) return;
      const events = dependencies.parseOtlp(request.body);
      await dependencies.ingestOtel(identity.workspace.id, events, identity.agent?.id);
      return { partialSuccess: { rejectedLogRecords: 0 } };
    },
  );

  return app;
}
