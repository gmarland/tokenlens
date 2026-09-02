import { describe, it, expect } from "vitest";
import { access, mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const entry = fileURLToPath(new URL("./index.ts", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

describe("CLI settings", () => {
  it(
    "preserves Claude settings, is idempotent, and uninstalls only owned entries",
    async () => {
      const root = await mkdtemp(path.join(tmpdir(), "tokenlens-cli-"));
      const settings = path.join(root, ".claude/settings.json");
      const state = path.join(root, "state");
      await mkdir(path.dirname(settings), { recursive: true });
      await writeFile(
        settings,
        JSON.stringify({
          theme: "dark",
          env: { TOKENLENS_CAPTURE_PROMPTS: "0" },
          hooks: {
            PostToolUse: [
              { hooks: [{ type: "command", command: "existing-hook" }] },
            ],
          },
        }),
      );
      await mkdir(state, { recursive: true });
      await writeFile(
        path.join(state, "config.json"),
        JSON.stringify({ endpoint: "http://old.test", key: "old", capture: false }),
      );
      const env = {
        ...process.env,
        TOKENLENS_SKIP_AGENT_REGISTRATION: "1",
        CLAUDE_SETTINGS_PATH: settings,
        REPO_PROFILER_HOME: state,
      };
      for (let i = 0; i < 2; i++)
        await exec(
          "pnpm",
          [
            "tsx",
            entry,
            "install",
            "--provider",
            "claude",
            "--endpoint",
            "http://localhost:3000",
            "--key",
            "secret",
          ],
          { env },
        );
      let value = JSON.parse(await readFile(settings, "utf8"));
      expect(value.theme).toBe("dark");
      expect(JSON.stringify(value).match(/repo-profiler hook tool/g)).toHaveLength(1);
      expect(JSON.stringify(value)).toContain("existing-hook");
      expect(value.env.TOKENLENS_CAPTURE_PROMPTS).toBeUndefined();
      const localConfig = JSON.parse(
        await readFile(path.join(state, "config.json"), "utf8"),
      );
      expect(localConfig).toEqual({
        endpoint: "http://localhost:3000",
        key: "secret",
        agentId: expect.any(String),
      });
      await exec(
        "pnpm",
        ["tsx", entry, "uninstall", "--provider", "claude"],
        { env },
      );
      value = JSON.parse(await readFile(settings, "utf8"));
      expect(value.theme).toBe("dark");
      expect(JSON.stringify(value)).toContain("existing-hook");
      expect(JSON.stringify(value)).not.toContain("TOKENLENS_ENDPOINT");
    },
    20_000,
  );

  it(
    "preserves Codex config and hooks while managing an idempotent owned block",
    async () => {
      const root = await mkdtemp(path.join(tmpdir(), "tokenlens-codex-"));
      const config = path.join(root, ".codex/config.toml");
      const hooks = path.join(root, ".codex/hooks.json");
      const state = path.join(root, "state");
      await mkdir(path.dirname(config), { recursive: true });
      await writeFile(
        config,
        'model = "gpt-test"\n\n[otel]\nexporter = "none"\n\n[ui]\nanimations = false\n',
      );
      await writeFile(
        hooks,
        JSON.stringify({
          description: "existing",
          hooks: {
            PostToolUse: [
              { hooks: [{ type: "command", command: "existing-hook" }] },
            ],
          },
        }),
      );
      const env = {
        ...process.env,
        TOKENLENS_SKIP_AGENT_REGISTRATION: "1",
        CODEX_CONFIG_PATH: config,
        CODEX_HOOKS_PATH: hooks,
        REPO_PROFILER_HOME: state,
      };
      const args = [
        "tsx",
        entry,
        "install",
        "--provider",
        "codex",
        "--endpoint",
        "http://localhost:3000",
        "--key",
        "secret",
      ];
      await expect(exec("pnpm", args, { env })).rejects.toThrow();
      for (let i = 0; i < 2; i++)
        await exec("pnpm", [...args, "--force"], { env });
      let configValue = await readFile(config, "utf8");
      let hookValue = JSON.parse(await readFile(hooks, "utf8"));
      expect(configValue).toContain('model = "gpt-test"');
      expect(configValue).toContain("[ui]");
      expect(configValue).not.toContain('exporter = "none"');
      expect(configValue).toContain("log_user_prompt = true");
      expect(configValue.match(/BEGIN TOKENLENS MANAGED OTEL/g)).toHaveLength(1);
      expect(JSON.stringify(hookValue)).toContain("existing-hook");
      expect(JSON.stringify(hookValue).match(/repo-profiler hook tool/g)).toHaveLength(1);

      await exec(
        "pnpm",
        ["tsx", entry, "uninstall", "--provider", "codex"],
        { env },
      );
      configValue = await readFile(config, "utf8");
      hookValue = JSON.parse(await readFile(hooks, "utf8"));
      expect(configValue).toContain('model = "gpt-test"');
      expect(configValue).not.toContain("TOKENLENS");
      expect(JSON.stringify(hookValue)).toContain("existing-hook");
      expect(JSON.stringify(hookValue)).not.toContain("repo-profiler hook");
    },
    20_000,
  );

  it(
    "rejects npm arguments without the separator before changing settings",
    async () => {
      const root = await mkdtemp(path.join(tmpdir(), "tokenlens-npm-args-"));
      const claudeSettings = path.join(root, ".claude/settings.json");
      const codexConfig = path.join(root, ".codex/config.toml");
      const state = path.join(root, "state");
      const env = {
        ...process.env,
        TOKENLENS_SKIP_AGENT_REGISTRATION: "1",
        CLAUDE_SETTINGS_PATH: claudeSettings,
        CODEX_CONFIG_PATH: codexConfig,
        CODEX_HOOKS_PATH: path.join(root, ".codex/hooks.json"),
        REPO_PROFILER_HOME: state,
      };

      await expect(
        exec(
          "npm",
          [
            "run",
            "repo-profiler",
            "install",
            "--provider",
            "codex",
            "--endpoint",
            "[http://localhost:3000](http://localhost:3000)",
            "--key",
            "secret",
          ],
          { cwd: repoRoot, env },
        ),
      ).rejects.toThrow();
      await expect(access(claudeSettings)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(access(codexConfig)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(access(path.join(state, "config.json"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
    20_000,
  );

  it("rejects a Markdown endpoint before changing settings", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "tokenlens-bad-endpoint-"));
    const settings = path.join(root, ".claude/settings.json");
    const state = path.join(root, "state");
    const env = {
      ...process.env,
      TOKENLENS_SKIP_AGENT_REGISTRATION: "1",
      CLAUDE_SETTINGS_PATH: settings,
      REPO_PROFILER_HOME: state,
    };

    await expect(
      exec(
        "pnpm",
        [
          "tsx",
          entry,
          "install",
          "--provider",
          "claude",
          "--endpoint",
          "[http://localhost:3000](http://localhost:3000)",
          "--key",
          "secret",
        ],
        { env },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("not a Markdown link"),
    });
    await expect(access(settings)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(path.join(state, "config.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it(
    "forwards separated npm arguments and installs only Codex",
    async () => {
      const root = await mkdtemp(path.join(tmpdir(), "tokenlens-npm-codex-"));
      const claudeSettings = path.join(root, ".claude/settings.json");
      const codexConfig = path.join(root, ".codex/config.toml");
      const codexHooks = path.join(root, ".codex/hooks.json");
      const state = path.join(root, "state");
      const env = {
        ...process.env,
        TOKENLENS_SKIP_AGENT_REGISTRATION: "1",
        CLAUDE_SETTINGS_PATH: claudeSettings,
        CODEX_CONFIG_PATH: codexConfig,
        CODEX_HOOKS_PATH: codexHooks,
        REPO_PROFILER_HOME: state,
      };

      const result = await exec(
        "npm",
        [
          "run",
          "repo-profiler",
          "--",
          "install",
          "--provider",
          "codex",
          "--endpoint",
          "http://localhost:3000/",
          "--key",
          "secret",
        ],
        { cwd: repoRoot, env },
      );

      expect(result.stdout).toContain(
        "Configured Codex telemetry and hooks for http://localhost:3000",
      );
      await expect(access(claudeSettings)).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readFile(codexConfig, "utf8")).toContain("BEGIN TOKENLENS");
      expect(JSON.parse(await readFile(codexHooks, "utf8"))).toHaveProperty(
        "hooks",
      );
      expect(
        JSON.parse(await readFile(path.join(state, "config.json"), "utf8")),
      ).toEqual({ endpoint: "http://localhost:3000", key: "secret", agentId: expect.any(String) });
    },
    20_000,
  );
});
