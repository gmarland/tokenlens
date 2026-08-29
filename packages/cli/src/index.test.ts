import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const entry = fileURLToPath(new URL("./index.ts", import.meta.url));

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
          hooks: {
            PostToolUse: [
              { hooks: [{ type: "command", command: "existing-hook" }] },
            ],
          },
        }),
      );
      const env = {
        ...process.env,
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
      await exec("pnpm", ["tsx", entry, "uninstall"], { env });
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
});
