import type { ObjectLiteral, Repository as TypeOrmRepository } from "typeorm";
import {
  ApiRequest,
  Developer,
  Prompt,
  RepoSnapshot,
  RepoSnapshotFile,
  RepoCommit,
  Repository,
  ToolEvent,
  ToolFileAccess,
  db,
} from "./index";
import type { PromptHook, ToolHook, SnapshotUpload, Provider } from "@tokenlens/shared";
import type { NormalizedAgentEvent } from "@tokenlens/otel-parser";
import { promptFingerprint } from "./prompt-fingerprint";

async function upsertAndFind<T extends ObjectLiteral>(
  repository: TypeOrmRepository<T>,
  values: Partial<T>,
  conflictPaths: (keyof T)[],
  where: Partial<T>,
): Promise<T> {
  await repository.upsert(values as any, {
    conflictPaths: conflictPaths as string[],
    skipUpdateIfNoValuesChanged: true,
  });
  return repository.findOneByOrFail(where as any);
}

async function stub(workspaceId: string, provider: Provider, externalPromptId: string, sessionId?: string) {
  const source = await db();
  const prompts = source.getRepository(Prompt);
  const existing = await prompts.findOneBy({ workspaceId, provider, externalPromptId });
  if (existing) {
    if (!existing.sessionId && sessionId) {
      existing.sessionId = sessionId;
      return prompts.save(existing);
    }
    return existing;
  }
  return upsertAndFind(prompts, { workspaceId, provider, externalPromptId, sessionId },
    ["workspaceId", "provider", "externalPromptId"], { workspaceId, provider, externalPromptId });
}

export async function promptForEvent(workspaceId: string, event: NormalizedAgentEvent) {
  const prompts = (await db()).getRepository(Prompt);
  if (event.provider === "codex" && event.sessionId) {
    const recent = await prompts.createQueryBuilder("prompt")
      .where("prompt.workspace_id = :workspaceId", { workspaceId })
      .andWhere("prompt.provider = :provider", { provider: "codex" })
      .andWhere("prompt.session_id = :sessionId", { sessionId: event.sessionId })
      .andWhere("prompt.hook_received_at IS NOT NULL")
      .andWhere("prompt.started_at <= :timestamp", { timestamp: event.timestamp })
      .orderBy("prompt.started_at", "DESC")
      .getOne();
    if (recent) return recent;
  }

  const exact = await prompts.findOneBy({ workspaceId, provider: event.provider, externalPromptId: event.promptId });
  if (exact) return exact;
  return stub(workspaceId, event.provider, event.promptId, event.sessionId);
}

export async function reconcileCodexSessionPrompt(prompt: Prompt) {
  if (prompt.provider !== "codex" || !prompt.sessionId || !prompt.startedAt) return;
  const source = await db();
  await source.transaction(async (manager) => {
    const parameters = [prompt.id];
    const candidates = (table: "api_requests" | "tool_events", timestamp: string) => `
      SELECT event.id event_id, bounds.target_prompt_id
      FROM ${table} event
      JOIN prompts stub ON stub.id = event.prompt_id
      CROSS JOIN LATERAL (
        SELECT target.id target_prompt_id,
          (SELECT min(next_prompt.started_at)
           FROM prompts next_prompt
           WHERE next_prompt.workspace_id = target.workspace_id
             AND next_prompt.provider = 'codex'
             AND next_prompt.session_id = target.session_id
             AND next_prompt.hook_received_at IS NOT NULL
             AND next_prompt.started_at > target.started_at) next_started_at
        FROM prompts target
        WHERE target.id = $1::uuid
      ) bounds
      WHERE stub.workspace_id = event.workspace_id
        AND stub.provider = 'codex'
        AND stub.session_id = (SELECT session_id FROM prompts WHERE id = $1::uuid)
        AND stub.hook_received_at IS NULL
        AND event.${timestamp} >= (SELECT started_at FROM prompts WHERE id = $1::uuid)
        AND (bounds.next_started_at IS NULL OR event.${timestamp} < bounds.next_started_at)
    `;

    const statements = [
      `
      WITH candidates AS (${candidates("api_requests", "timestamp")})
      DELETE FROM api_requests duplicate
      USING candidates
      WHERE duplicate.id = candidates.event_id
        AND EXISTS (
          SELECT 1 FROM api_requests existing
          WHERE existing.workspace_id = duplicate.workspace_id
            AND existing.prompt_id = candidates.target_prompt_id
            AND existing.event_sequence = duplicate.event_sequence
            AND existing.id <> duplicate.id
        )`,
      `
      WITH candidates AS (${candidates("api_requests", "timestamp")})
      UPDATE api_requests event
      SET prompt_id = candidates.target_prompt_id
      FROM candidates
      WHERE event.id = candidates.event_id`,
      `
      WITH candidates AS (${candidates("tool_events", "timestamp")})
      DELETE FROM tool_events duplicate
      USING candidates
      WHERE duplicate.id = candidates.event_id
        AND EXISTS (
          SELECT 1 FROM tool_events existing
          WHERE existing.workspace_id = duplicate.workspace_id
            AND existing.prompt_id = candidates.target_prompt_id
            AND existing.tool_use_id = duplicate.tool_use_id
            AND existing.id <> duplicate.id
        )`,
      `
      WITH candidates AS (${candidates("tool_events", "timestamp")})
      UPDATE tool_events event
      SET prompt_id = candidates.target_prompt_id
      FROM candidates
      WHERE event.id = candidates.event_id`,
      `
      DELETE FROM prompts stub
      WHERE stub.provider = 'codex'
        AND stub.workspace_id = (SELECT workspace_id FROM prompts WHERE id = $1::uuid)
        AND stub.session_id = (SELECT session_id FROM prompts WHERE id = $1::uuid)
        AND stub.hook_received_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM api_requests WHERE prompt_id = stub.id)
        AND NOT EXISTS (SELECT 1 FROM tool_events WHERE prompt_id = stub.id)`,
    ];
    for (const statement of statements) await manager.query(statement, parameters);
  });
}

export async function ingestPrompt(workspaceId: string, input: PromptHook) {
  const source = await db();
  const repositories = source.getRepository(Repository);
  const snapshots = source.getRepository(RepoSnapshot);
  let repositoryId: string | undefined;
  let snapshotId: string | undefined;

  if (input.repoKey) {
    const repository = await upsertAndFind(repositories, {
      workspaceId,
      repoKey: input.repoKey,
      name: input.repoName ?? input.repoKey,
      remoteHost: input.remoteHost,
      remoteOwner: input.remoteOwner,
      remoteName: input.remoteName,
      lastSeenAt: new Date(),
    }, ["workspaceId", "repoKey"], { workspaceId, repoKey: input.repoKey });
    repositoryId = repository.id;
    if (input.snapshotFingerprint) {
      snapshotId = (await snapshots.findOneBy({ repositoryId, fingerprint: input.snapshotFingerprint }))?.id;
    }
  }

  const prompt = await upsertAndFind(source.getRepository(Prompt), {
    workspaceId,
    provider: input.provider,
    externalPromptId: input.promptId,
    sessionId: input.sessionId,
    repositoryId,
    snapshotId,
    promptLength: input.promptLength,
    promptText: input.promptText,
    promptFingerprint: promptFingerprint(input.promptText),
    model: input.model,
    branch: input.branch,
    headSha: input.headSha,
    dirty: input.dirty,
    startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
    hookReceivedAt: new Date(),
  }, ["workspaceId", "provider", "externalPromptId"], {
    workspaceId,
    provider: input.provider,
    externalPromptId: input.promptId,
  });
  await reconcileCodexSessionPrompt(prompt);
  return prompt;
}

export async function ingestTool(workspaceId: string, input: ToolHook) {
  const source = await db();
  const prompt = await stub(workspaceId, input.provider, input.promptId, input.sessionId);
  const event = await upsertAndFind(source.getRepository(ToolEvent), {
    workspaceId,
    promptId: prompt.id,
    toolUseId: input.toolUseId,
    ingestSource: "hook",
    toolName: input.toolName,
    relativeFilePath: input.relativeFilePath,
    timestamp: input.timestamp ? new Date(input.timestamp) : new Date(),
  }, ["workspaceId", "promptId", "toolUseId"], {
    workspaceId,
    promptId: prompt.id,
    toolUseId: input.toolUseId,
  });
  const editTools = new Set(["edit", "write", "notebookedit", "apply_patch"]);
  const accesses = input.fileAccesses ?? (input.relativeFilePath ? [{
    kind: editTools.has(input.toolName.toLowerCase()) ? "edit" as const : "read" as const,
    relativeFilePath: input.relativeFilePath,
    attribution: "explicit_tool" as const,
  }] : []);
  for (const access of accesses) {
    await source.getRepository(ToolFileAccess).upsert({
      toolEventId: event.id,
      kind: access.kind,
      relativeFilePath: access.relativeFilePath,
      attribution: access.attribution,
    }, {
      conflictPaths: ["toolEventId", "kind", "relativeFilePath"],
      skipUpdateIfNoValuesChanged: true,
    });
  }
  return event;
}

export async function ingestOtel(workspaceId: string, events: NormalizedAgentEvent[]) {
  const source = await db();
  const developers = source.getRepository(Developer);
  const prompts = source.getRepository(Prompt);
  const apiRequests = source.getRepository(ApiRequest);
  const toolEvents = source.getRepository(ToolEvent);

  for (const event of events) {
    const prompt = await promptForEvent(workspaceId, event);
    const identity = event.user?.externalId ?? event.user?.accountUuid ?? event.user?.accountId ??
      event.user?.anonymousId ?? event.user?.email;
    if (identity) {
      const developer = await upsertAndFind(developers, {
        workspaceId,
        provider: event.provider,
        externalId: identity,
        email: event.user?.email,
        lastSeenAt: new Date(),
      }, ["workspaceId", "provider", "externalId"], {
        workspaceId,
        provider: event.provider,
        externalId: identity,
      });
      const attribution = prompts.createQueryBuilder()
        .update(Prompt)
        .set({ developerId: developer.id })
        .where("workspace_id = :workspaceId", { workspaceId })
        .andWhere("provider = :provider", { provider: event.provider })
        .andWhere("developer_id IS NULL");
      if (event.sessionId) {
        attribution.andWhere("(id = :promptId OR session_id = :sessionId)", {
          promptId: prompt.id,
          sessionId: event.sessionId,
        });
      } else {
        attribution.andWhere("id = :promptId", { promptId: prompt.id });
      }
      await attribution.execute();
    }

    if (event.kind === "api_request") {
      await apiRequests.upsert({
        workspaceId,
        promptId: prompt.id,
        eventSequence: event.sequence,
        requestId: event.requestId,
        model: event.model ?? prompt.model,
        querySource: event.querySource,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        cacheReadTokens: event.cacheReadTokens,
        cacheCreationTokens: event.cacheCreationTokens,
        cacheMetricsAvailable: event.cacheMetricsAvailable,
        costUsd: event.costUsd === undefined ? null : String(event.costUsd),
        durationMs: event.durationMs,
        timestamp: event.timestamp,
      }, {
        conflictPaths: ["workspaceId", "promptId", "eventSequence"],
        skipUpdateIfNoValuesChanged: true,
      });
    }
    if (event.kind === "tool_result") {
      await upsertAndFind(toolEvents, {
        workspaceId,
        promptId: prompt.id,
        toolUseId: event.toolUseId,
        ingestSource: "otel",
        toolName: event.toolName,
        success: event.success,
        durationMs: event.durationMs,
        toolInputSizeBytes: event.toolInputSizeBytes,
        toolResultSizeBytes: event.toolResultSizeBytes,
        timestamp: event.timestamp,
      }, ["workspaceId", "promptId", "toolUseId"], {
        workspaceId,
        promptId: prompt.id,
        toolUseId: event.toolUseId,
      });
    }
  }
  return { accepted: events.length };
}

export async function ingestSnapshot(workspaceId: string, input: SnapshotUpload) {
  const source = await db();
  const repository = await upsertAndFind(source.getRepository(Repository), {
    workspaceId,
    repoKey: input.repoKey,
    name: input.repoName,
    remoteHost: input.remoteHost,
    remoteOwner: input.remoteOwner,
    remoteName: input.remoteName,
    lastSeenAt: new Date(),
  }, ["workspaceId", "repoKey"], { workspaceId, repoKey: input.repoKey });

  const metrics = input.metrics as any;
  const snapshot = await upsertAndFind(source.getRepository(RepoSnapshot), {
    repositoryId: repository.id,
    fingerprint: input.fingerprint,
    headSha: input.headSha,
    branch: input.branch,
    dirty: input.dirty,
    capturedAt: new Date(input.capturedAt),
    trackedFiles: metrics.trackedFiles,
    sourceFiles: metrics.sourceFiles,
    totalSourceLoc: metrics.totalSourceLoc,
    medianFileLoc: metrics.medianFileLoc,
    p75FileLoc: metrics.p75FileLoc,
    p90FileLoc: metrics.p90FileLoc,
    p95FileLoc: metrics.p95FileLoc,
    maxFileLoc: metrics.maxFileLoc,
    filesOver500Loc: metrics.filesOver500Loc,
    filesOver1000Loc: metrics.filesOver1000Loc,
    filesOver2000Loc: metrics.filesOver2000Loc,
    directoryCount: metrics.directoryCount,
    medianDirectoryDepth: metrics.medianDirectoryDepth,
    p95DirectoryDepth: metrics.p95DirectoryDepth,
    maxDirectoryDepth: metrics.maxDirectoryDepth,
    packageCount: metrics.packageCount,
    testFileCount: metrics.testFileCount,
    testToSourceRatio: metrics.testToSourceRatio,
    documentationFileCount: metrics.documentationFileCount,
    claudeMdCount: metrics.claudeMdCount,
    claudeMdTotalBytes: metrics.claudeMdTotalBytes,
    agentsMdCount: metrics.agentsMdCount ?? 0,
    agentsMdTotalBytes: metrics.agentsMdTotalBytes ?? 0,
    instructionFingerprint: metrics.instructionFingerprint ?? null,
    generatedFileCount: metrics.generatedFileCount,
    generatedFileBytes: metrics.generatedFileBytes,
    dependencyGraphNodes: metrics.dependencyGraphNodes,
    dependencyGraphEdges: metrics.dependencyGraphEdges,
    meanFanOut: metrics.meanFanOut,
    p95FanOut: metrics.p95FanOut,
    meanFanIn: metrics.meanFanIn,
    p95FanIn: metrics.p95FanIn,
    maxFanIn: metrics.maxFanIn,
    maxFanOut: metrics.maxFanOut,
    dependencyCycleCount: metrics.dependencyCycleCount,
    crossModuleEdgeCount: metrics.crossModuleEdgeCount,
    crossModuleEdgeRatio: metrics.crossModuleEdgeRatio,
    languageDistributionJson: metrics.languageDistribution,
  }, ["repositoryId", "fingerprint"], { repositoryId: repository.id, fingerprint: input.fingerprint });

  if (input.files.length) {
    await source.getRepository(RepoSnapshotFile).createQueryBuilder().insert()
      .values(input.files.map((file) => ({ snapshotId: snapshot.id, ...file })))
      .orIgnore().execute();
  }
  if (input.commits.length) {
    await source.getRepository(RepoCommit).createQueryBuilder().insert()
      .values(input.commits.map((commit) => ({
        repositoryId: repository.id,
        sha: commit.sha,
        authorName: commit.authorName,
        authorEmail: commit.authorEmail,
        authoredAt: new Date(commit.authoredAt),
        committerName: commit.committerName,
        committerEmail: commit.committerEmail,
        committedAt: new Date(commit.committedAt),
        observedBranch: input.branch,
        firstObservedAt: new Date(input.capturedAt),
      })))
      .orIgnore().execute();
  }
  await source.getRepository(Prompt).createQueryBuilder().update()
    .set({ snapshotId: snapshot.id })
    .where("repository_id = :repositoryId AND head_sha = :headSha", { repositoryId: repository.id, headSha: input.headSha })
    .execute();
  return snapshot;
}
