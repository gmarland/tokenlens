import { and, desc, eq, lte, sql } from "drizzle-orm";
import {
  db,
  developers,
  repositories,
  repoSnapshots,
  repoSnapshotFiles,
  prompts,
  apiRequests,
  toolEvents,
} from "./index";
import type {
  PromptHook,
  ToolHook,
  SnapshotUpload,
  Provider,
} from "@tokenlens/shared";
import type { NormalizedAgentEvent } from "@tokenlens/otel-parser";

async function stub(
  workspaceId: string,
  provider: Provider,
  externalPromptId: string,
  sessionId?: string,
) {
  const [p] = await db()
    .insert(prompts)
    .values({ workspaceId, provider, externalPromptId, sessionId })
    .onConflictDoUpdate({
      target: [
        prompts.workspaceId,
        prompts.provider,
        prompts.externalPromptId,
      ],
      set: {
        sessionId: sql`coalesce(${prompts.sessionId}, excluded.session_id)`,
      },
    })
    .returning();
  return p;
}

async function promptForEvent(workspaceId: string, e: NormalizedAgentEvent) {
  const [exact] = await db()
    .select()
    .from(prompts)
    .where(
      and(
        eq(prompts.workspaceId, workspaceId),
        eq(prompts.provider, e.provider),
        eq(prompts.externalPromptId, e.promptId),
      ),
    )
    .limit(1);
  if (exact) return exact;

  // Some Codex OTel transports currently identify the conversation but not the
  // hook turn. Associate such events with the latest submitted turn in that
  // session. A direct turn id, when present, always wins through the exact lookup.
  if (e.provider === "codex" && e.sessionId) {
    const [recent] = await db()
      .select()
      .from(prompts)
      .where(
        and(
          eq(prompts.workspaceId, workspaceId),
          eq(prompts.provider, "codex"),
          eq(prompts.sessionId, e.sessionId),
          lte(prompts.startedAt, e.timestamp),
        ),
      )
      .orderBy(desc(prompts.startedAt))
      .limit(1);
    if (recent) return recent;
  }
  return stub(workspaceId, e.provider, e.promptId, e.sessionId);
}

export async function ingestPrompt(
  workspaceId: string,
  x: PromptHook,
  capture = false,
) {
  let repositoryId: string | undefined;
  let snapshotId: string | undefined;
  if (x.repoKey) {
    const [r] = await db()
      .insert(repositories)
      .values({
        workspaceId,
        repoKey: x.repoKey,
        name: x.repoName ?? x.repoKey,
        remoteHost: x.remoteHost,
        remoteOwner: x.remoteOwner,
        remoteName: x.remoteName,
      })
      .onConflictDoUpdate({
        target: [repositories.workspaceId, repositories.repoKey],
        set: { lastSeenAt: new Date() },
      })
      .returning();
    repositoryId = r.id;
    if (x.snapshotFingerprint) {
      const [s] = await db()
        .select({ id: repoSnapshots.id })
        .from(repoSnapshots)
        .where(
          and(
            eq(repoSnapshots.repositoryId, r.id),
            eq(repoSnapshots.fingerprint, x.snapshotFingerprint),
          ),
        )
        .limit(1);
      snapshotId = s?.id;
    }
  }
  const [p] = await db()
    .insert(prompts)
    .values({
      workspaceId,
      provider: x.provider,
      externalPromptId: x.promptId,
      sessionId: x.sessionId,
      repositoryId,
      snapshotId,
      promptLength: x.promptLength,
      promptText: capture ? x.promptText : undefined,
      model: x.model,
      branch: x.branch,
      headSha: x.headSha,
      dirty: x.dirty,
      startedAt: x.startedAt ? new Date(x.startedAt) : new Date(),
      hookReceivedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        prompts.workspaceId,
        prompts.provider,
        prompts.externalPromptId,
      ],
      set: {
        sessionId: x.sessionId,
        repositoryId,
        snapshotId,
        promptLength: x.promptLength,
        promptText: capture ? x.promptText : undefined,
        model: x.model,
        branch: x.branch,
        headSha: x.headSha,
        dirty: x.dirty,
        hookReceivedAt: new Date(),
      },
    })
    .returning();
  return p;
}

export async function ingestTool(workspaceId: string, x: ToolHook) {
  const p = await stub(
    workspaceId,
    x.provider,
    x.promptId,
    x.sessionId,
  );
  return db()
    .insert(toolEvents)
    .values({
      workspaceId,
      promptId: p.id,
      toolUseId: x.toolUseId,
      toolName: x.toolName,
      relativeFilePath: x.relativeFilePath,
      timestamp: x.timestamp ? new Date(x.timestamp) : new Date(),
    })
    .onConflictDoUpdate({
      target: [toolEvents.workspaceId, toolEvents.promptId, toolEvents.toolUseId],
      set: {
        toolName: x.toolName,
        relativeFilePath: x.relativeFilePath,
      },
    });
}

export async function ingestOtel(
  workspaceId: string,
  events: NormalizedAgentEvent[],
) {
  for (const e of events) {
    const p = await promptForEvent(workspaceId, e);
    const identity =
      e.user?.externalId ??
      e.user?.accountUuid ??
      e.user?.accountId ??
      e.user?.anonymousId ??
      e.user?.email;
    if (identity) {
      const [d] = await db()
        .insert(developers)
        .values({
          workspaceId,
          provider: e.provider,
          externalId: identity,
          email: e.user?.email,
        })
        .onConflictDoUpdate({
          target: [
            developers.workspaceId,
            developers.provider,
            developers.externalId,
          ],
          set: { email: e.user?.email, lastSeenAt: new Date() },
        })
        .returning();
      await db()
        .update(prompts)
        .set({ developerId: d.id })
        .where(eq(prompts.id, p.id));
    }
    if (e.kind === "api_request")
      await db()
        .insert(apiRequests)
        .values({
          workspaceId,
          promptId: p.id,
          eventSequence: e.sequence,
          requestId: e.requestId,
          model: e.model ?? p.model,
          querySource: e.querySource,
          inputTokens: e.inputTokens,
          outputTokens: e.outputTokens,
          cacheReadTokens: e.cacheReadTokens,
          cacheCreationTokens: e.cacheCreationTokens,
          costUsd: e.costUsd === undefined ? null : String(e.costUsd),
          durationMs: e.durationMs,
          timestamp: e.timestamp,
        })
        .onConflictDoNothing();
    if (e.kind === "tool_result")
      await db()
        .insert(toolEvents)
        .values({
          workspaceId,
          promptId: p.id,
          toolUseId: e.toolUseId,
          toolName: e.toolName,
          success: e.success,
          durationMs: e.durationMs,
          toolInputSizeBytes: e.toolInputSizeBytes,
          toolResultSizeBytes: e.toolResultSizeBytes,
          timestamp: e.timestamp,
        })
        .onConflictDoUpdate({
          target: [
            toolEvents.workspaceId,
            toolEvents.promptId,
            toolEvents.toolUseId,
          ],
          set: {
            toolName: e.toolName,
            success: e.success,
            durationMs: e.durationMs,
            toolInputSizeBytes: e.toolInputSizeBytes,
            toolResultSizeBytes: e.toolResultSizeBytes,
            timestamp: e.timestamp,
          },
        });
  }
  return { accepted: events.length };
}

export async function ingestSnapshot(workspaceId: string, x: SnapshotUpload) {
  const [r] = await db()
    .insert(repositories)
    .values({
      workspaceId,
      repoKey: x.repoKey,
      name: x.repoName,
      remoteHost: x.remoteHost,
      remoteOwner: x.remoteOwner,
      remoteName: x.remoteName,
    })
    .onConflictDoUpdate({
      target: [repositories.workspaceId, repositories.repoKey],
      set: { lastSeenAt: new Date() },
    })
    .returning();
  const m = x.metrics as any;
  const [s] = await db()
    .insert(repoSnapshots)
    .values({
      repositoryId: r.id,
      fingerprint: x.fingerprint,
      headSha: x.headSha,
      branch: x.branch,
      dirty: x.dirty,
      capturedAt: new Date(x.capturedAt),
      trackedFiles: m.trackedFiles,
      sourceFiles: m.sourceFiles,
      totalSourceLoc: m.totalSourceLoc,
      medianFileLoc: m.medianFileLoc,
      p75FileLoc: m.p75FileLoc,
      p90FileLoc: m.p90FileLoc,
      p95FileLoc: m.p95FileLoc,
      maxFileLoc: m.maxFileLoc,
      filesOver500Loc: m.filesOver500Loc,
      filesOver1000Loc: m.filesOver1000Loc,
      filesOver2000Loc: m.filesOver2000Loc,
      directoryCount: m.directoryCount,
      medianDirectoryDepth: m.medianDirectoryDepth,
      p95DirectoryDepth: m.p95DirectoryDepth,
      maxDirectoryDepth: m.maxDirectoryDepth,
      packageCount: m.packageCount,
      testFileCount: m.testFileCount,
      testToSourceRatio: m.testToSourceRatio,
      documentationFileCount: m.documentationFileCount,
      claudeMdCount: m.claudeMdCount,
      claudeMdTotalBytes: m.claudeMdTotalBytes,
      agentsMdCount: m.agentsMdCount ?? 0,
      agentsMdTotalBytes: m.agentsMdTotalBytes ?? 0,
      generatedFileCount: m.generatedFileCount,
      generatedFileBytes: m.generatedFileBytes,
      dependencyGraphNodes: m.dependencyGraphNodes,
      dependencyGraphEdges: m.dependencyGraphEdges,
      meanFanOut: m.meanFanOut,
      p95FanOut: m.p95FanOut,
      meanFanIn: m.meanFanIn,
      p95FanIn: m.p95FanIn,
      maxFanIn: m.maxFanIn,
      maxFanOut: m.maxFanOut,
      dependencyCycleCount: m.dependencyCycleCount,
      crossModuleEdgeCount: m.crossModuleEdgeCount,
      crossModuleEdgeRatio: m.crossModuleEdgeRatio,
      languageDistributionJson: m.languageDistribution,
    })
    .onConflictDoUpdate({
      target: [repoSnapshots.repositoryId, repoSnapshots.fingerprint],
      set: { capturedAt: new Date(x.capturedAt) },
    })
    .returning();
  if (x.files.length)
    await db()
      .insert(repoSnapshotFiles)
      .values(x.files.map((f) => ({ snapshotId: s.id, ...f })))
      .onConflictDoNothing();
  await db()
    .update(prompts)
    .set({ snapshotId: s.id })
    .where(
      and(eq(prompts.repositoryId, r.id), eq(prompts.headSha, x.headSha)),
    );
  return s;
}
