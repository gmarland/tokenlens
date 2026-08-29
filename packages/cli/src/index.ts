#!/usr/bin/env node
import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { detectRepository, analyzeRepository } from "@tokenlens/repo-analyzer";
import type { Provider } from "@tokenlens/shared";

const exec = promisify(execFile);
const userHome = homedir();
const appDir = process.env.REPO_PROFILER_HOME ?? path.join(userHome, ".repo-profiler");
const appConfigPath = path.join(appDir, "config.json");
const claudeSettingsPath =
  process.env.CLAUDE_SETTINGS_PATH ??
  path.join(userHome, ".claude", "settings.json");
const codexConfigPath =
  process.env.CODEX_CONFIG_PATH ?? path.join(userHome, ".codex", "config.toml");
const codexHooksPath =
  process.env.CODEX_HOOKS_PATH ?? path.join(userHome, ".codex", "hooks.json");
const logPath = path.join(appDir, "diagnostics.log");
const hookCommand = "repo-profiler hook";
const codexBlockStart = "# BEGIN TOKENLENS MANAGED OTEL";
const codexBlockEnd = "# END TOKENLENS MANAGED OTEL";
const ownedClaudeEnv = [
  "TOKENLENS_INSTALLED",
  "TOKENLENS_ENDPOINT",
  "TOKENLENS_INGEST_KEY",
  "TOKENLENS_CAPTURE_PROMPTS",
  "CLAUDE_CODE_ENABLE_TELEMETRY",
  "OTEL_LOGS_EXPORTER",
  "OTEL_EXPORTER_OTLP_LOGS_PROTOCOL",
  "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT",
  "OTEL_EXPORTER_OTLP_LOGS_HEADERS",
];

const quietLog = async (message: string) => {
  await mkdir(appDir, { recursive: true });
  await writeFile(logPath, `${new Date().toISOString()} ${message}\n`, {
    flag: "a",
  });
};

async function json(file: string, fallback: any = {}) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function textFile(file: string) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function stdin() {
  let s = "";
  for await (const c of process.stdin) s += c;
  return JSON.parse(s || "{}");
}

async function config() {
  const local = await json(appConfigPath);
  const claude = await json(claudeSettingsPath);
  return {
    endpoint:
      process.env.TOKENLENS_ENDPOINT ??
      local.endpoint ??
      claude.env?.TOKENLENS_ENDPOINT,
    key:
      process.env.TOKENLENS_INGEST_KEY ??
      local.key ??
      claude.env?.TOKENLENS_INGEST_KEY,
    capture:
      (process.env.TOKENLENS_CAPTURE_PROMPTS ??
        (local.capture === undefined
          ? claude.env?.TOKENLENS_CAPTURE_PROMPTS
          : local.capture
            ? "1"
            : "0")) === "1",
  };
}

async function persistConfig(endpoint: string, key: string, capture: boolean) {
  await mkdir(appDir, { recursive: true });
  await writeFile(
    appConfigPath,
    JSON.stringify({ endpoint, key, capture }, null, 2) + "\n",
    { mode: 0o600 },
  );
}

async function post(route: string, body: any) {
  const c = await config();
  if (!c.endpoint || !c.key)
    throw new Error("Profiler endpoint/key are not configured");
  const r = await fetch(`${c.endpoint}${route}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${c.key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`${route} returned ${r.status}`);
  return r;
}

async function deviceId() {
  await mkdir(appDir, { recursive: true });
  const f = path.join(appDir, "device-id");
  try {
    return (await readFile(f, "utf8")).trim();
  } catch {
    const id = randomUUID();
    await writeFile(f, id, { mode: 0o600 });
    return id;
  }
}

async function backup(file: string) {
  try {
    await copyFile(
      file,
      `${file}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    );
  } catch {}
}

function claudeHookEntry(kind: "prompt" | "tool") {
  return {
    matcher:
      kind === "prompt" ? undefined : "Read|Edit|Write|NotebookEdit|Glob|Grep",
    hooks: [
      {
        type: "command",
        command: `${hookCommand} ${kind} --provider claude`,
        async: true,
        timeout: 120,
      },
    ],
  };
}

function codexHookEntry(kind: "prompt" | "tool") {
  return {
    ...(kind === "tool"
      ? { matcher: "Bash|apply_patch|Edit|Write|Read|mcp__.*" }
      : {}),
    hooks: [
      {
        type: "command",
        command: `${hookCommand} ${kind} --provider codex`,
        async: true,
        timeout: 120,
      },
    ],
  };
}

async function installClaude(endpoint: string, key: string, capture: boolean, force: boolean) {
  await mkdir(path.dirname(claudeSettingsPath), { recursive: true });
  const s = await json(claudeSettingsPath);
  const env = s.env ?? {};
  if (env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT && !env.TOKENLENS_INSTALLED && !force)
    throw new Error(
      "Existing Claude OTel log destination found. Re-run with --force to replace it after backup.",
    );
  await backup(claudeSettingsPath);
  const headers = `Authorization=Bearer%20${encodeURIComponent(key)}`;
  s.env = {
    ...env,
    TOKENLENS_INSTALLED: "1",
    TOKENLENS_ENDPOINT: endpoint,
    TOKENLENS_INGEST_KEY: key,
    TOKENLENS_CAPTURE_PROMPTS: capture ? "1" : "0",
    CLAUDE_CODE_ENABLE_TELEMETRY: "1",
    OTEL_LOGS_EXPORTER: "otlp",
    OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: "http/json",
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `${endpoint}/api/ingest/otel/v1/logs`,
    OTEL_EXPORTER_OTLP_LOGS_HEADERS: headers,
  };
  s.hooks ??= {};
  for (const [event, kind] of [
    ["UserPromptSubmit", "prompt"],
    ["PostToolUse", "tool"],
  ] as const) {
    const list = Array.isArray(s.hooks[event]) ? s.hooks[event] : [];
    s.hooks[event] = [
      ...list.filter((x: any) => !JSON.stringify(x).includes(hookCommand)),
      claudeHookEntry(kind),
    ];
  }
  await writeFile(claudeSettingsPath, JSON.stringify(s, null, 2) + "\n", {
    mode: 0o600,
  });
}

function stripCodexBlock(input: string) {
  const start = input.indexOf(codexBlockStart);
  if (start < 0) return input;
  const end = input.indexOf(codexBlockEnd, start);
  if (end < 0) return input.slice(0, start).trimEnd() + "\n";
  return (
    input.slice(0, start).trimEnd() +
    "\n" +
    input.slice(end + codexBlockEnd.length).trimStart()
  );
}

function removeExistingOtel(input: string) {
  const lines = input.split(/\r?\n/);
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (/^\s*otel\s*=/.test(line)) continue;
    const table = line.match(/^\s*\[([^\]]+)\]\s*$/)?.[1];
    if (table === "otel" || table?.startsWith("otel.")) {
      skipping = true;
      continue;
    }
    if (skipping && table && !table.startsWith("otel.")) skipping = false;
    if (!skipping) out.push(line);
  }
  return out.join("\n").trimEnd() + "\n";
}

function codexOtelBlock(endpoint: string, key: string, capture: boolean) {
  const target = JSON.stringify(`${endpoint}/api/ingest/otel/v1/logs`);
  const auth = JSON.stringify(`Bearer ${key}`);
  return `${codexBlockStart}\n[otel]\nenvironment = "tokenlens"\nlog_user_prompt = ${capture}\nexporter = { otlp-http = { endpoint = ${target}, protocol = "json", headers = { Authorization = ${auth} } } }\n${codexBlockEnd}\n`;
}

async function installCodex(endpoint: string, key: string, capture: boolean, force: boolean) {
  await mkdir(path.dirname(codexConfigPath), { recursive: true });
  await mkdir(path.dirname(codexHooksPath), { recursive: true });
  const original = await textFile(codexConfigPath);
  let configText = stripCodexBlock(original);
  const hasOtherOtel = /^\s*\[otel(?:\.|\])|^\s*otel\s*=/m.test(configText);
  if (hasOtherOtel && !force)
    throw new Error(
      "Existing Codex OTel configuration found. Re-run with --force to replace it after backup.",
    );
  if (hasOtherOtel) configText = removeExistingOtel(configText);
  await backup(codexConfigPath);
  await writeFile(
    codexConfigPath,
    `${configText.trimEnd()}${configText.trim() ? "\n\n" : ""}${codexOtelBlock(endpoint, key, capture)}`,
    { mode: 0o600 },
  );

  const hooks = await json(codexHooksPath, { hooks: {} });
  hooks.hooks ??= {};
  for (const [event, kind] of [
    ["UserPromptSubmit", "prompt"],
    ["PostToolUse", "tool"],
  ] as const) {
    const list = Array.isArray(hooks.hooks[event]) ? hooks.hooks[event] : [];
    hooks.hooks[event] = [
      ...list.filter((x: any) => !JSON.stringify(x).includes(hookCommand)),
      codexHookEntry(kind),
    ];
  }
  await backup(codexHooksPath);
  await writeFile(codexHooksPath, JSON.stringify(hooks, null, 2) + "\n", {
    mode: 0o600,
  });
}

function providerArg(args: string[]): Provider | "all" {
  const i = args.indexOf("--provider");
  const value = i >= 0 ? args[i + 1] : "claude";
  if (!(["claude", "codex", "all"] as string[]).includes(value))
    throw new Error("Use --provider claude|codex|all");
  return value as Provider | "all";
}

async function install(args: string[]) {
  const endpointValue = args[args.indexOf("--endpoint") + 1];
  const endpoint =
    endpointValue && !endpointValue.startsWith("--")
      ? endpointValue
      : "http://localhost:3000";
  const key = args[args.indexOf("--key") + 1];
  if (!key || key.startsWith("--"))
    throw new Error("Use --key <workspace-ingest-key>");
  const force = args.includes("--force");
  const capture = args.includes("--capture-prompts");
  const provider = providerArg(args);
  await persistConfig(endpoint, key, capture);
  if (provider === "claude" || provider === "all")
    await installClaude(endpoint, key, capture, force);
  if (provider === "codex" || provider === "all")
    await installCodex(endpoint, key, capture, force);
  await deviceId();
  console.log(
    `Configured ${provider === "all" ? "Claude Code and Codex" : provider === "codex" ? "Codex" : "Claude Code"} telemetry and hooks (${capture ? "prompt capture ON" : "prompt capture OFF"}).`,
  );
  if (provider === "codex" || provider === "all")
    console.log("Open /hooks in Codex to review and trust the installed hooks.");
}

async function uninstallClaude() {
  const s = await json(claudeSettingsPath);
  if (s.env?.TOKENLENS_INSTALLED)
    for (const k of ownedClaudeEnv) delete s.env[k];
  for (const event of ["UserPromptSubmit", "PostToolUse"])
    if (Array.isArray(s.hooks?.[event]))
      s.hooks[event] = s.hooks[event].filter(
        (x: any) => !JSON.stringify(x).includes(hookCommand),
      );
  await writeFile(claudeSettingsPath, JSON.stringify(s, null, 2) + "\n", {
    mode: 0o600,
  });
}

async function uninstallCodex() {
  const hooks = await json(codexHooksPath, { hooks: {} });
  for (const event of ["UserPromptSubmit", "PostToolUse"])
    if (Array.isArray(hooks.hooks?.[event]))
      hooks.hooks[event] = hooks.hooks[event].filter(
        (x: any) => !JSON.stringify(x).includes(hookCommand),
      );
  await writeFile(codexHooksPath, JSON.stringify(hooks, null, 2) + "\n", {
    mode: 0o600,
  });
  const current = await textFile(codexConfigPath);
  await writeFile(codexConfigPath, stripCodexBlock(current), { mode: 0o600 });
}

async function uninstall(args: string[]) {
  const provider = providerArg(args);
  if (provider === "claude" || provider === "all") await uninstallClaude();
  if (provider === "codex" || provider === "all") await uninstallCodex();
  console.log(`Removed TokenLens-owned ${provider} settings.`);
}

async function identify(cwd: string) {
  return detectRepository(cwd, await deviceId());
}

async function promptHook(provider: Provider) {
  try {
    const x = await stdin();
    const c = await config();
    const r = await identify(x.cwd ?? process.cwd());
    const promptId =
      provider === "codex" ? x.turn_id ?? x.turnId : x.prompt_id ?? x.promptId;
    const sessionId = x.session_id ?? x.sessionId;
    const prompt = String(x.prompt ?? "");
    await post("/api/ingest/prompt", {
      provider,
      promptId,
      sessionId,
      promptLength: prompt.length,
      ...(c.capture ? { promptText: prompt } : {}),
      model: x.model,
      repoKey: r.repoKey,
      repoName: r.repoName,
      remoteHost: r.remoteHost,
      remoteOwner: r.remoteOwner,
      remoteName: r.remoteName,
      branch: r.branch,
      headSha: r.headSha,
      dirty: r.dirty,
      snapshotFingerprint: r.fingerprint,
      startedAt: new Date().toISOString(),
    });
    await scan(r.root, true, r);
  } catch (e) {
    await quietLog(
      `${provider} prompt hook: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

function patchPaths(command: string) {
  return [...command.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)].map(
    (m) => m[1].trim(),
  );
}

function relativePaths(x: any, provider: Provider) {
  const input = x.tool_input ?? {};
  const direct = input.file_path ?? input.notebook_path ?? input.path;
  if (direct) return [String(direct)];
  if (provider === "codex" && (x.tool_name ?? x.toolName) === "apply_patch")
    return patchPaths(String(input.command ?? ""));
  return [];
}

async function toolHook(provider: Provider) {
  try {
    const x = await stdin();
    const rawToolName = x.tool_name ?? x.toolName;
    const toolName = rawToolName === "apply_patch" ? "Edit" : rawToolName;
    const promptId =
      provider === "codex" ? x.turn_id ?? x.turnId : x.prompt_id ?? x.promptId;
    const sessionId = x.session_id ?? x.sessionId;
    const toolUseId = x.tool_use_id ?? x.toolUseId;
    const raws = relativePaths(x, provider);
    const paths: (string | undefined)[] = raws.length ? raws : [undefined];
    let repo: Awaited<ReturnType<typeof identify>> | undefined;
    for (const [index, raw] of paths.entries()) {
      let relativeFilePath: string | undefined;
      if (raw) {
        repo ??= await identify(x.cwd ?? process.cwd());
        const absolute = path.resolve(x.cwd ?? repo.root, raw);
        const rel = path.relative(repo.root, absolute).split(path.sep).join("/");
        if (rel.startsWith("../") || path.isAbsolute(rel))
          throw new Error("tool path is outside repository");
        relativeFilePath = rel;
      }
      await post("/api/ingest/tool", {
        provider,
        promptId,
        sessionId,
        toolUseId: paths.length > 1 ? `${toolUseId}:${index}` : toolUseId,
        toolName,
        ...(relativeFilePath ? { relativeFilePath } : {}),
        timestamp: new Date().toISOString(),
      });
    }
  } catch (e) {
    await quietLog(
      `${provider} tool hook: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

async function scan(
  input: string,
  fromHook = false,
  known?: Awaited<ReturnType<typeof detectRepository>>,
) {
  const r = known ?? (await identify(path.resolve(input)));
  const cacheFile = path.join(appDir, "cache.json");
  const cache = await json(cacheFile, { snapshots: [] });
  if (cache.snapshots.includes(r.fingerprint) && !process.argv.includes("--force"))
    return;
  const analysis = await analyzeRepository(r.root);
  await post("/api/ingest/snapshot", {
    repoKey: r.repoKey,
    repoName: r.repoName,
    remoteHost: r.remoteHost,
    remoteOwner: r.remoteOwner,
    remoteName: r.remoteName,
    fingerprint: r.fingerprint,
    headSha: r.headSha,
    branch: r.branch,
    dirty: r.dirty,
    capturedAt: new Date().toISOString(),
    ...analysis,
  });
  cache.snapshots = [...new Set([...cache.snapshots, r.fingerprint])].slice(-100);
  await mkdir(appDir, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(cache), { mode: 0o600 });
  if (!fromHook)
    console.log(
      `Uploaded ${analysis.metrics.sourceFiles} source files and ${analysis.metrics.totalSourceLoc} LOC; no source content was sent.`,
    );
}

async function doctor(args: string[]) {
  const provider = providerArg(args);
  const checks: [string, () => Promise<any>][] = [
    ["Git available", () => exec("git", ["--version"])],
    [
      "API reachable, authentication valid, backend healthy",
      async () => {
        const c = await config();
        const r = await fetch(`${c.endpoint}/api/health`, {
          headers: { authorization: `Bearer ${c.key}` },
        });
        if (!r.ok) throw Error(`HTTP ${r.status}`);
      },
    ],
  ];
  if (provider === "claude" || provider === "all")
    checks.unshift(
      ["Claude executable found", () => exec("claude", ["--version"])],
      [
        "Claude hooks installed",
        async () => {
          const s = await json(claudeSettingsPath);
          if (!JSON.stringify(s.hooks).includes(hookCommand))
            throw Error("run repo-profiler install --provider claude");
        },
      ],
      [
        "Claude OTel configured",
        async () => {
          const s = await json(claudeSettingsPath);
          if (!s.env?.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT)
            throw Error("run repo-profiler install --provider claude");
        },
      ],
    );
  if (provider === "codex" || provider === "all")
    checks.unshift(
      ["Codex executable found", () => exec("codex", ["--version"])],
      [
        "Codex hooks installed",
        async () => {
          const s = await json(codexHooksPath);
          if (!JSON.stringify(s.hooks).includes(hookCommand))
            throw Error("run repo-profiler install --provider codex");
        },
      ],
      [
        "Codex OTel configured",
        async () => {
          if (!(await textFile(codexConfigPath)).includes(codexBlockStart))
            throw Error("run repo-profiler install --provider codex");
        },
      ],
    );
  for (const [name, fn] of checks)
    try {
      await fn();
      console.log(`✓ ${name}`);
    } catch (e) {
      console.log(`✗ ${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
}

async function main() {
  const [cmd, sub, ...rest] = process.argv.slice(2);
  const args = [sub, ...rest].filter(Boolean);
  if (cmd === "install") return install(args);
  if (cmd === "uninstall") return uninstall(args);
  if (cmd === "doctor") return doctor(args);
  if (cmd === "scan")
    return scan(sub && !sub.startsWith("--") ? sub : ".");
  if (cmd === "hook" && sub === "prompt")
    return promptHook(providerArg(rest) as Provider);
  if (cmd === "hook" && sub === "tool")
    return toolHook(providerArg(rest) as Provider);
  console.log(
    "repo-profiler install|uninstall|doctor [--provider claude|codex|all] | scan [path] [--force]",
  );
}

await main().catch(async (e) => {
  if (process.argv[2] === "hook") await quietLog(e.message);
  else {
    console.error(e.message);
    process.exitCode = 1;
  }
});
