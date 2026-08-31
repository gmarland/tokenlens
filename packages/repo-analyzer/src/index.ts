import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { median, percentile } from "@tokenlens/analytics";
import type { FileMetric } from "@tokenlens/shared";
const exec = promisify(execFile);
const languageByExt: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".c": "c",
  ".h": "c",
  ".php": "php",
  ".swift": "swift",
  ".scala": "scala",
  ".sh": "shell",
  ".sql": "sql",
};
const slash = (s: string) => s.split(path.sep).join("/");
const isTest = (p: string) =>
  /(^|\/)(__tests__|test|tests|spec)(\/|$)|\.(test|spec)\.[^.]+$/i.test(p);
const isDoc = (p: string) =>
  /(^|\/)(docs?|documentation)(\/|$)|\.(md|mdx|rst|adoc)$/i.test(p);
const isGenerated = (p: string, text: string) =>
  /(^|\/)(dist|build|generated|vendor)(\/|$)|\.min\.[^.]+$/i.test(p) ||
  /(@generated|generated file|do not edit)/i.test(text.slice(0, 500));
function imports(text: string, file: string) {
  const sf = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    ),
    out: string[] = [];
  const walk = (n: ts.Node) => {
    let s: ts.Expression | undefined;
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n))
      s = n.moduleSpecifier;
    else if (
      ts.isCallExpression(n) &&
      (n.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(n.expression) && n.expression.text === "require"))
    )
      s = n.arguments[0];
    if (s && ts.isStringLiteral(s) && s.text.startsWith(".")) out.push(s.text);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}
function resolveImport(from: string, spec: string, files: Set<string>) {
  const b = path.posix.normalize(
    path.posix.join(path.posix.dirname(from), spec),
  );
  for (const c of [
    b,
    ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].map((e) => b + e),
    ...[".ts", ".tsx", ".js", ".jsx"].map((e) => b + "/index" + e),
  ])
    if (files.has(c)) return c;
}
function scc(nodes: string[], edges: Map<string, string[]>) {
  let i = 0;
  const stack: string[] = [],
    on = new Set<string>(),
    idx = new Map<string, number>(),
    low = new Map<string, number>(),
    groups: string[][] = [];
  function visit(v: string) {
    idx.set(v, i);
    low.set(v, i++);
    stack.push(v);
    on.add(v);
    for (const w of edges.get(v) ?? []) {
      if (!idx.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (on.has(w)) low.set(v, Math.min(low.get(v)!, idx.get(w)!));
    }
    if (low.get(v) === idx.get(v)) {
      const g: string[] = [];
      let w;
      do {
        w = stack.pop()!;
        on.delete(w);
        g.push(w);
      } while (w !== v);
      if (g.length > 1 || (edges.get(v) ?? []).includes(v)) groups.push(g);
    }
  }
  for (const n of nodes) if (!idx.has(n)) visit(n);
  return groups;
}
async function git(root: string, args: string[]) {
  return (
    await exec("git", ["-C", root, ...args], { maxBuffer: 50_000_000 })
  ).stdout.trim();
}
export async function detectRepository(
  input = process.cwd(),
  deviceId = "local",
) {
  const root = await git(input, ["rev-parse", "--show-toplevel"]),
    headSha = await git(root, ["rev-parse", "HEAD"]),
    branch = await git(root, ["branch", "--show-current"]),
    remote = await git(root, ["config", "--get", "remote.origin.url"]).catch(
      () => "",
    ),
    status = await git(root, ["status", "--porcelain=v1"]),
    normalized = normalizeRemote(remote);
  const repoKey =
    normalized?.key ??
    (await import("node:crypto"))
      .createHash("sha256")
      .update(deviceId + path.resolve(root))
      .digest("hex");
  const bucket = Math.floor(Date.now() / 300000);
  const fingerprint = status
    ? (await import("node:crypto"))
        .createHash("sha256")
        .update(headSha + status + bucket)
        .digest("hex")
    : headSha;
  return {
    root,
    repoKey,
    repoName: normalized?.name ?? path.basename(root),
    remoteHost: normalized?.host,
    remoteOwner: normalized?.owner,
    remoteName: normalized?.name,
    branch,
    headSha,
    dirty: Boolean(status),
    fingerprint,
  };
}

export async function analyzeCommits(root: string, limit = 250) {
  const output = await git(root, [
    "log",
    `--max-count=${limit}`,
    "--format=%H%x1f%aI%x1f%an%x1f%ae%x1f%cI%x1f%cn%x1f%ce%x1e",
  ]).catch(() => "");
  return output.split("\x1e").map((record) => record.trim()).filter(Boolean).map((record) => {
    const [sha, authoredAt, authorName, authorEmail, committedAt, committerName, committerEmail] = record.split("\x1f");
    return {
      sha,
      authorName,
      authorEmail,
      authoredAt: new Date(authoredAt).toISOString(),
      committerName,
      committerEmail,
      committedAt: new Date(committedAt).toISOString(),
    };
  }).filter((commit) => commit.sha && commit.committedAt);
}
export function normalizeRemote(remote: string) {
  if (!remote) return null;
  let s = remote.trim().replace(/^git@([^:]+):/, "ssh://git@$1/");
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`),
      parts = u.pathname
        .replace(/^\/|\.git$/g, "")
        .split("/")
        .filter(Boolean);
    if (parts.length < 2) return null;
    const name = parts.pop()!,
      owner = parts.join("/");
    return {
      host: u.hostname.toLowerCase(),
      owner,
      name,
      key: `${u.hostname.toLowerCase()}/${owner}/${name}`,
    };
  } catch {
    return null;
  }
}
export async function analyzeRepository(root: string) {
  const raw = await git(root, [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
    ]),
    paths = raw.split("\0").filter(Boolean).map(slash),
    fileSet = new Set(paths),
    boundaries = new Set(
      paths
        .filter((p) =>
          /(^|\/)(package\.json|pyproject\.toml|go\.mod|Cargo\.toml)$|\.csproj$/i.test(
            p,
          ),
        )
        .map((p) => path.posix.dirname(p)),
    ),
    texts = new Map<string, string>(),
    base: any[] = [];
  for (const p of paths) {
    const full = path.join(root, p),
      st = await stat(full).catch(() => null);
    if (!st?.isFile()) continue;
    const ext = path.extname(p).toLowerCase(),
      language = languageByExt[ext];
    let text = "";
    if (
      language ||
      isDoc(p) ||
      ["claude.md", "agents.md"].includes(path.basename(p).toLowerCase())
    )
      text = await readFile(full, "utf8").catch(() => "");
    if (language) texts.set(p, text);
    base.push({
      path: p,
      extension: ext,
      language: language ?? "other",
      bytes: st.size,
      loc: text ? text.split(/\r?\n/).length : 0,
      directoryDepth:
        path.posix.dirname(p) === "."
          ? 0
          : path.posix.dirname(p).split("/").length,
      isTest: isTest(p),
      isGenerated: isGenerated(p, text),
      isDocumentation: isDoc(p),
      text,
    });
  }
  const moduleOf = (p: string) => {
    let d = path.posix.dirname(p);
    while (d !== ".") {
      if (boundaries.has(d)) return d;
      d = path.posix.dirname(d);
    }
    return p.split("/").length > 1 ? p.split("/")[0] : "root";
  };
  const edges = new Map<string, string[]>();
  for (const f of base.filter((f) => /[jt]sx?$/.test(f.extension)))
    edges.set(
      f.path,
      imports(f.text, f.path)
        .map((x: string) => resolveImport(f.path, x, fileSet))
        .filter((x: string | undefined): x is string => Boolean(x)),
    );
  const fanIn = new Map<string, number>();
  for (const outs of edges.values())
    for (const x of outs) fanIn.set(x, (fanIn.get(x) ?? 0) + 1);
  const cycles = scc([...edges.keys()], edges),
    cycleFiles = new Set(cycles.flat());
  const files: FileMetric[] = base
    .filter((f) => f.language !== "other")
    .map((f) => {
      const outs = edges.get(f.path) ?? [],
        module = moduleOf(f.path);
      return {
        path: f.path,
        extension: f.extension,
        language: f.language,
        bytes: f.bytes,
        loc: f.loc,
        directoryDepth: f.directoryDepth,
        moduleName: module,
        isTest: f.isTest,
        isGenerated: f.isGenerated,
        isDocumentation: f.isDocumentation,
        dependencyFanIn: fanIn.get(f.path) ?? 0,
        dependencyFanOut: outs.length,
        crossModuleDependencies: outs.filter(
          (x: string) => moduleOf(x) !== module,
        ).length,
        inDependencyCycle: cycleFiles.has(f.path),
      };
    });
  const locs = files.map((f) => f.loc),
    depths = base.map((f) => f.directoryDepth),
    outs = files.map((f) => f.dependencyFanOut),
    ins = files.map((f) => f.dependencyFanIn),
    cross = files.reduce((n, f) => n + f.crossModuleDependencies, 0),
    edgeCount = outs.reduce((a, b) => a + b, 0),
    langs: Record<string, { files: number; loc: number }> = {};
  for (const f of files) {
    langs[f.language] ??= { files: 0, loc: 0 };
    langs[f.language].files++;
    langs[f.language].loc += f.loc;
  }
  const docs = base.filter((f) => f.isDocumentation),
    claudes = base.filter(
      (f) => path.basename(f.path).toLowerCase() === "claude.md",
    ),
    agents = base.filter(
      (f) => path.basename(f.path).toLowerCase() === "agents.md",
    ),
    generated = base.filter((f) => f.isGenerated);
  return {
    metrics: {
      trackedFiles: base.length,
      sourceFiles: files.length,
      totalSourceLoc: locs.reduce((a, b) => a + b, 0),
      medianFileLoc: median(locs),
      p75FileLoc: percentile(locs, 75),
      p90FileLoc: percentile(locs, 90),
      p95FileLoc: percentile(locs, 95),
      maxFileLoc: Math.max(0, ...locs),
      filesOver500Loc: locs.filter((x) => x > 500).length,
      filesOver1000Loc: locs.filter((x) => x > 1000).length,
      filesOver2000Loc: locs.filter((x) => x > 2000).length,
      directoryCount: new Set(base.map((f) => path.posix.dirname(f.path))).size,
      medianDirectoryDepth: median(depths),
      p95DirectoryDepth: percentile(depths, 95),
      maxDirectoryDepth: Math.max(0, ...depths),
      packageCount: boundaries.size,
      testFileCount: files.filter((f) => f.isTest).length,
      testToSourceRatio: files.length
        ? files.filter((f) => f.isTest).length / files.length
        : 0,
      documentationFileCount: docs.length,
      claudeMdCount: claudes.length,
      claudeMdTotalBytes: claudes.reduce((n, f) => n + f.bytes, 0),
      agentsMdCount: agents.length,
      agentsMdTotalBytes: agents.reduce((n, f) => n + f.bytes, 0),
      generatedFileCount: generated.length,
      generatedFileBytes: generated.reduce((n, f) => n + f.bytes, 0),
      dependencyGraphNodes: edges.size,
      dependencyGraphEdges: edgeCount,
      meanFanOut: files.length ? edgeCount / files.length : 0,
      p95FanOut: percentile(outs, 95),
      maxFanOut: Math.max(0, ...outs),
      meanFanIn: files.length
        ? ins.reduce((a, b) => a + b, 0) / files.length
        : 0,
      p95FanIn: percentile(ins, 95),
      maxFanIn: Math.max(0, ...ins),
      dependencyCycleCount: cycles.length,
      crossModuleEdgeCount: cross,
      crossModuleEdgeRatio: edgeCount ? cross / edgeCount : 0,
      languageDistribution: langs,
    },
    files,
    commits: await analyzeCommits(root),
  };
}
