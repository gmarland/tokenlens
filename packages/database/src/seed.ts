import {
  db,
  dataSource,
  Workspace,
  Developer,
  Repository,
  RepoSnapshot,
  RepoSnapshotFile,
  Prompt,
  ApiRequest,
  ToolEvent,
} from "./index";
import { hashKey } from "./auth";

const key = process.env.TOKENLENS_INGEST_KEY ?? "development-key-change-me";
const database = await db();
let seed = 42;
const rnd = () =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;

const workspaceRepository = database.getRepository(Workspace);
let workspace = await workspaceRepository.findOneBy({ ingestKeyHash: hashKey(key) });
workspace = await workspaceRepository.save({
    ...workspace,
    name: "TokenLens demo",
    ingestKeyHash: hashKey(key),
    isDemo: true,
  });
await database.getRepository(Repository).delete({ workspaceId: workspace.id });
await database.getRepository(Developer).delete({ workspaceId: workspace.id });

const developerSpecs = [
  ["alex@example.test", "claude"],
  ["jamie@example.test", "codex"],
  ["sam@example.test", "claude"],
] as const;
const devs = await database.getRepository(Developer).save(
    developerSpecs.map(([email, provider], i) => ({
      workspaceId: workspace.id,
      provider,
      email,
      externalId: `demo-developer-${i}`,
      firstSeenAt: new Date("2026-05-01"),
      lastSeenAt: new Date("2026-08-20"),
    })),
  );

const specs = [
  { name: "legacy-platform", loc: 1_400_000, files: 6842, packages: 31, scale: 2.4 },
  { name: "payments", loc: 382_000, files: 1850, packages: 18, scale: 1.45 },
  { name: "frontend", loc: 241_000, files: 1420, packages: 22, scale: 1 },
  { name: "small-modular", loc: 72_000, files: 510, packages: 14, scale: 0.62 },
];
const api: any[] = [];
const tools: any[] = [];
let promptNo = 0;

for (const [ri, spec] of specs.entries()) {
  const repo = await database.getRepository(Repository).save({
      workspaceId: workspace.id,
      repoKey: `github.com/demo/${spec.name}`,
      name: spec.name,
      remoteHost: "github.com",
      remoteOwner: "demo",
      remoteName: spec.name,
    });
  let activeSnapshot: any;
  for (let si = 0; si < 2; si++) {
    const factor = 1 + si * 0.025;
    const snapshot = await database.getRepository(RepoSnapshot).save({
        repositoryId: repo.id,
        fingerprint: `demo-${ri}-${si}`,
        headSha: `${ri}${si}`.repeat(20),
        branch: "main",
        dirty: false,
        capturedAt: new Date(Date.UTC(2026, 5 + si, 1)),
        trackedFiles: Math.round(spec.files * 1.18 * factor),
        sourceFiles: Math.round(spec.files * factor),
        totalSourceLoc: Math.round(spec.loc * factor),
        medianFileLoc: Math.round(90 * spec.scale),
        p75FileLoc: Math.round(180 * spec.scale),
        p90FileLoc: Math.round(360 * spec.scale),
        p95FileLoc: Math.round(620 * spec.scale),
        maxFileLoc: Math.round(2100 * spec.scale),
        filesOver500Loc: Math.round(42 * spec.scale),
        filesOver1000Loc: Math.round(15 * spec.scale),
        filesOver2000Loc: Math.round(4 * spec.scale),
        directoryCount: Math.round(spec.files / 8),
        medianDirectoryDepth: 3,
        p95DirectoryDepth: 5 + ri,
        maxDirectoryDepth: 8 + ri,
        packageCount: spec.packages,
        testFileCount: Math.round(spec.files * 0.24),
        testToSourceRatio: 0.24,
        documentationFileCount: 30 + ri * 8,
        claudeMdCount: ri === 0 ? 2 : 1,
        claudeMdTotalBytes: ri === 0 ? 18000 : 5000,
        agentsMdCount: ri === 0 ? 3 : 1,
        agentsMdTotalBytes: ri === 0 ? 22000 : 4500,
        generatedFileCount: Math.round(spec.files * 0.03),
        generatedFileBytes: Math.round(spec.loc * 3),
        dependencyGraphNodes: Math.round(spec.files * 0.72),
        dependencyGraphEdges: Math.round(spec.files * spec.scale * 2),
        meanFanOut: 2 * spec.scale,
        p95FanOut: Math.round(9 * spec.scale),
        maxFanOut: Math.round(28 * spec.scale),
        meanFanIn: 2 * spec.scale,
        p95FanIn: Math.round(10 * spec.scale),
        maxFanIn: Math.round(32 * spec.scale),
        dependencyCycleCount: Math.round(8 * spec.scale),
        crossModuleEdgeCount: Math.round(spec.files * 0.4 * spec.scale),
        crossModuleEdgeRatio: 0.08 * spec.scale,
        languageDistributionJson: {
          typescript: { files: Math.round(spec.files * 0.78), loc: Math.round(spec.loc * 0.82) },
          javascript: { files: Math.round(spec.files * 0.12), loc: Math.round(spec.loc * 0.1) },
          python: { files: Math.round(spec.files * 0.1), loc: Math.round(spec.loc * 0.08) },
        },
      });
    activeSnapshot = snapshot;
    const files = Array.from({ length: 60 }, (_, i) => {
      const moduleName = `packages/module-${i % spec.packages}`;
      const loc = Math.max(20, Math.round((40 + i * 9) * spec.scale));
      return {
        snapshotId: snapshot.id,
        path: `${moduleName}/src/file-${i}.ts`,
        language: "typescript",
        extension: ".ts",
        bytes: loc * 42,
        loc,
        directoryDepth: 4,
        moduleName,
        isTest: i % 5 === 0,
        isGenerated: false,
        isDocumentation: false,
        dependencyFanIn: Math.round((i % 11) * spec.scale),
        dependencyFanOut: Math.round((i % 13) * spec.scale),
        crossModuleDependencies: Math.round((i % 4) * spec.scale),
        inDependencyCycle: i % 17 === 0,
      };
    });
    await database.getRepository(RepoSnapshotFile).insert(files);
  }

  const count = ri === 0 ? 75 : ri === 1 ? 65 : 55;
  for (let j = 0; j < count; j++) {
    promptNo++;
    const provider = j % 4 === 0 ? "codex" : "claude";
    const started = new Date(Date.UTC(2026, 5, 1) + promptNo * 7.2 * 3600_000);
    const working = Math.max(2, Math.round((3 + rnd() * 7) * spec.scale));
    const context = Math.round(
      (42000 + working * 19000 + working ** 1.5 * 3500) *
        spec.scale *
        (0.88 + rnd() * 0.24),
    );
    const p = await database.getRepository(Prompt).save({
        workspaceId: workspace.id,
        provider,
        externalPromptId: `demo-${provider}-prompt-${promptNo}`,
        sessionId: `demo-${provider}-session-${Math.floor(promptNo / 4)}`,
        developerId: devs[provider === "codex" ? 1 : promptNo % 2 === 0 ? 0 : 2].id,
        repositoryId: repo.id,
        snapshotId: activeSnapshot.id,
        promptLength: 80 + Math.round(rnd() * 400),
        promptText: `Investigate token usage pattern ${promptNo} in ${spec.name} and propose a focused improvement.`,
        model: provider === "codex" ? "gpt-5.6-sol" : "claude-sonnet-4-5",
        branch: "main",
        headSha: activeSnapshot.headSha,
        dirty: false,
        startedAt: started,
        hookReceivedAt: new Date(+started + 100),
      });
    const model = provider === "codex" ? "gpt-5.6-sol" : "claude-sonnet-4-5";
    const calls = 2 + Math.floor(rnd() * 4);
    for (let a = 0; a < calls; a++)
      api.push({
        workspaceId: workspace.id,
        promptId: p.id,
        eventSequence: String(a),
        requestId: `req-${promptNo}-${a}`,
        model,
        querySource: provider === "codex" ? "codex" : "agent",
        inputTokens: Math.round((context / calls) * 0.18),
        cacheReadTokens: Math.round((context / calls) * 0.7),
        cacheCreationTokens: provider === "codex" ? 0 : Math.round((context / calls) * 0.12),
        outputTokens: 500 + Math.round(rnd() * 1800),
        costUsd: provider === "codex" ? null : String(context / 1e6 * 3 + 0.001 + rnd() * 0.01),
        durationMs: 1200 + Math.round(rnd() * 5000),
        timestamp: new Date(+started + a * 12000),
      });
    for (let t = 0; t < working; t++) {
      const file = Math.floor((rnd() * 0.75 + (t / working) * 0.25) * 60) % 60;
      const filePath = `packages/module-${file % spec.packages}/src/file-${file}.ts`;
      tools.push({
        workspaceId: workspace.id,
        promptId: p.id,
        toolUseId: `tool-${promptNo}-${t}`,
        toolName: "Read",
        success: true,
        durationMs: 30 + Math.round(rnd() * 300),
        toolInputSizeBytes: 80,
        toolResultSizeBytes: Math.round((2000 + file * 220) * spec.scale),
        relativeFilePath: filePath,
        timestamp: new Date(+started + 4000 + t * 3500),
      });
    }
  }
}

for (let i = 0; i < api.length; i += 500)
  await database.getRepository(ApiRequest).insert(api.slice(i, i + 500));
for (let i = 0; i < tools.length; i += 500)
  await database.getRepository(ToolEvent).insert(tools.slice(i, i + 500));
console.log(
  `Seeded ${specs.length} repositories, ${devs.length} developers, ${promptNo} prompts, ${api.length} model responses and ${tools.length} tool events.`,
);
console.log(`Demo ingest key: ${key}`);
await dataSource.destroy();
