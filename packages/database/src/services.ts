import type { ObjectLiteral, Repository as TypeOrmRepository } from "typeorm";
import {
  ApiRequest,
  Developer,
  Prompt,
  RepoSnapshot,
  RepoSnapshotFile,
  Repository,
  ToolEvent,
  db,
} from "./index";
import type { PromptHook, ToolHook, SnapshotUpload, Provider } from "@tokenlens/shared";
import type { NormalizedAgentEvent } from "@tokenlens/otel-parser";

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

async function promptForEvent(workspaceId: string, event: NormalizedAgentEvent) {
  const prompts = (await db()).getRepository(Prompt);
  const exact = await prompts.findOneBy({ workspaceId, provider: event.provider, externalPromptId: event.promptId });
  if (exact) return exact;

  if (event.provider === "codex" && event.sessionId) {
    const recent = await prompts.createQueryBuilder("prompt")
      .where("prompt.workspace_id = :workspaceId", { workspaceId })
      .andWhere("prompt.provider = :provider", { provider: "codex" })
      .andWhere("prompt.session_id = :sessionId", { sessionId: event.sessionId })
      .andWhere("prompt.started_at <= :timestamp", { timestamp: event.timestamp })
      .orderBy("prompt.started_at", "DESC")
      .getOne();
    if (recent) return recent;
  }
  return stub(workspaceId, event.provider, event.promptId, event.sessionId);
}

export async function ingestPrompt(workspaceId: string, input: PromptHook, capture = false) {
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

  return upsertAndFind(source.getRepository(Prompt), {
    workspaceId,
    provider: input.provider,
    externalPromptId: input.promptId,
    sessionId: input.sessionId,
    repositoryId,
    snapshotId,
    promptLength: input.promptLength,
    promptText: capture ? input.promptText : undefined,
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
}

export async function ingestTool(workspaceId: string, input: ToolHook) {
  const source = await db();
  const prompt = await stub(workspaceId, input.provider, input.promptId, input.sessionId);
  return upsertAndFind(source.getRepository(ToolEvent), {
    workspaceId,
    promptId: prompt.id,
    toolUseId: input.toolUseId,
    toolName: input.toolName,
    relativeFilePath: input.relativeFilePath,
    timestamp: input.timestamp ? new Date(input.timestamp) : new Date(),
  }, ["workspaceId", "promptId", "toolUseId"], {
    workspaceId,
    promptId: prompt.id,
    toolUseId: input.toolUseId,
  });
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
      await prompts.update(prompt.id, { developerId: developer.id });
    }

    if (event.kind === "api_request") {
      await apiRequests.createQueryBuilder().insert().values({
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
        costUsd: event.costUsd === undefined ? null : String(event.costUsd),
        durationMs: event.durationMs,
        timestamp: event.timestamp,
      }).orIgnore().execute();
    }
    if (event.kind === "tool_result") {
      await upsertAndFind(toolEvents, {
        workspaceId,
        promptId: prompt.id,
        toolUseId: event.toolUseId,
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
  await source.getRepository(Prompt).createQueryBuilder().update()
    .set({ snapshotId: snapshot.id })
    .where("repository_id = :repositoryId AND head_sha = :headSha", { repositoryId: repository.id, headSha: input.headSha })
    .execute();
  return snapshot;
}
