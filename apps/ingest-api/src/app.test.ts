import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, type IngestApiDependencies } from "./app";

const authorization = { authorization: "Bearer test-key" };

function dependencies(): IngestApiDependencies {
  return {
    authenticate: vi.fn(async (header, agentId) =>
      header === authorization.authorization
        ? { workspace: { id: "workspace-1", name: "Test workspace" }, agent: agentId ? { id: agentId } : null }
        : null,
    ),
    checkDatabase: vi.fn(async () => undefined),
    ingestPrompt: vi.fn(async () => ({ id: "prompt-1" })),
    ingestTool: vi.fn(async () => undefined),
    ingestSnapshot: vi.fn(async () => ({ id: "snapshot-1" })),
    parseOtlp: vi.fn(() => []),
    ingestOtel: vi.fn(async () => undefined),
    registerAgent: vi.fn(async (_workspaceId, input) => ({ id: input.id })),
  };
}

describe("ingestion API", () => {
  let service: IngestApiDependencies;

  beforeEach(() => {
    service = dependencies();
  });

  it("exposes liveness, readiness, and authenticated CLI health", async () => {
    const app = buildApp(service);
    expect((await app.inject({ method: "GET", url: "/health/live" })).json()).toEqual({
      ok: true,
    });
    expect((await app.inject({ method: "GET", url: "/health/ready" })).json()).toEqual({
      ok: true,
      database: "healthy",
    });
    const unauthorized = await app.inject({ method: "GET", url: "/api/health" });
    expect(unauthorized.statusCode).toBe(401);
    const health = await app.inject({
      method: "GET",
      url: "/api/health",
      headers: authorization,
    });
    expect(health.json()).toEqual({
      ok: true,
      database: "healthy",
      workspace: "Test workspace",
      agent: null,
    });
    await app.close();
  });

  it("accepts prompt, tool, snapshot, and OTLP requests", async () => {
    const app = buildApp(service);
    const prompt = await app.inject({
      method: "POST",
      url: "/api/ingest/prompt",
      headers: authorization,
      payload: {
        provider: "claude",
        promptId: "prompt-1",
        sessionId: "session-1",
        promptLength: 5,
        promptText: "hello",
      },
    });
    expect(prompt.statusCode).toBe(200);
    expect(prompt.json()).toEqual({ id: "prompt-1" });

    const tool = await app.inject({
      method: "POST",
      url: "/api/ingest/tool",
      headers: authorization,
      payload: {
        provider: "codex",
        promptId: "prompt-1",
        sessionId: "session-1",
        toolUseId: "tool-1",
        toolName: "Read",
        fileAccesses: [{
          kind: "read",
          relativeFilePath: "src/a.ts",
          attribution: "explicit_tool",
        }],
      },
    });
    expect(tool.json()).toEqual({ accepted: true });
    expect(service.ingestTool).toHaveBeenCalledWith("workspace-1", expect.objectContaining({
      fileAccesses: [{
        kind: "read",
        relativeFilePath: "src/a.ts",
        attribution: "explicit_tool",
      }],
    }), undefined);

    const snapshot = await app.inject({
      method: "POST",
      url: "/api/ingest/snapshot",
      headers: authorization,
      payload: {
        repoKey: "github.com/acme/example",
        repoName: "example",
        fingerprint: "fingerprint",
        headSha: "abc123",
        branch: "main",
        dirty: false,
        capturedAt: "2026-08-30T10:00:00.000Z",
        metrics: {},
        files: [],
      },
    });
    expect(snapshot.json()).toEqual({ id: "snapshot-1" });
    expect(service.ingestSnapshot).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({ commits: [] }),
      undefined,
    );

    const otlp = await app.inject({
      method: "POST",
      url: "/api/ingest/otel/v1/logs",
      headers: authorization,
      payload: { resourceLogs: [] },
    });
    expect(otlp.json()).toEqual({ partialSuccess: { rejectedLogRecords: 0 } });
    expect(service.ingestOtel).toHaveBeenCalledWith("workspace-1", [], undefined);
    await app.close();
  });

  it("registers and attributes an installation independently of the workspace key", async () => {
    const app = buildApp(service);
    const agentId = "11111111-1111-4111-8111-111111111111";
    const registration = await app.inject({
      method: "POST",
      url: "/api/agents/register",
      headers: authorization,
      payload: { id: agentId, name: "Gareth's Mac", providers: ["codex"] },
    });
    expect(registration.statusCode).toBe(200);
    expect(service.registerAgent).toHaveBeenCalledWith("workspace-1", expect.objectContaining({ id: agentId }));

    await app.inject({
      method: "POST",
      url: "/api/ingest/prompt",
      headers: { ...authorization, "x-tokenlens-agent-id": agentId },
      payload: {
        provider: "codex",
        promptId: "prompt-1",
        sessionId: "session-1",
        promptLength: 5,
        promptText: "hello",
      },
    });
    expect(service.ingestPrompt).toHaveBeenCalledWith("workspace-1", expect.anything(), agentId);
    await app.close();
  });

  it("rejects unauthorized, invalid, malformed, and oversized payloads", async () => {
    const app = buildApp(service);
    const unauthorized = await app.inject({
      method: "POST",
      url: "/api/ingest/tool",
      payload: {},
    });
    expect(unauthorized.statusCode).toBe(401);

    const invalid = await app.inject({
      method: "POST",
      url: "/api/ingest/prompt",
      headers: authorization,
      payload: {},
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({ error: "invalid payload" });

    const malformed = await app.inject({
      method: "POST",
      url: "/api/ingest/prompt",
      headers: { ...authorization, "content-type": "application/json" },
      payload: "{",
    });
    expect(malformed.statusCode).toBe(400);

    const oversized = await app.inject({
      method: "POST",
      url: "/api/ingest/prompt",
      headers: { ...authorization, "content-type": "application/json" },
      payload: JSON.stringify({ value: "x".repeat(64_000) }),
    });
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json()).toEqual({ error: "payload too large" });
    await app.close();
  });

  it("returns 503 when the readiness database check fails", async () => {
    service.checkDatabase = vi.fn(async () => {
      throw new Error("database unavailable");
    });
    const app = buildApp(service);
    const response = await app.inject({ method: "GET", url: "/health/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ ok: false, database: "unavailable" });
    await app.close();
  });
});
