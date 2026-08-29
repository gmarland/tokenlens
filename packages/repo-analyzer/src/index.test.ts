import { describe, it, expect } from "vitest";
import { normalizeRemote, analyzeRepository } from "./index";
import { mkdtemp, cp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const dependencyCycleFixture = fileURLToPath(
  new URL("../../../fixtures/repos/dependency-cycle", import.meta.url),
);

describe("remote normalization", () => {
  it.each([
    "git@github.com:acme/payments.git",
    "https://github.com/acme/payments.git",
    "https://user:secret@github.com/acme/payments",
  ])("normalizes %s", (x) =>
    expect(normalizeRemote(x)?.key).toBe("github.com/acme/payments"),
  );
});

describe("repository analysis", () => {
  it("detects package boundaries, imports, instructions, tests and cycles", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "tokenlens-repo-"));
    await cp(dependencyCycleFixture, root, {
      recursive: true,
    });
    await writeFile(path.join(root, "AGENTS.md"), "# Repository instructions\n");
    await exec("git", ["init", "-q", root]);
    await exec("git", ["-C", root, "add", "."]);
    const x = await analyzeRepository(root);
    expect(x.metrics.sourceFiles).toBe(2);
    expect(x.metrics.packageCount).toBe(1);
    expect(x.metrics.agentsMdCount).toBe(1);
    expect(x.metrics.agentsMdTotalBytes).toBeGreaterThan(0);
    expect(x.metrics.dependencyGraphEdges).toBe(2);
    expect(x.metrics.dependencyCycleCount).toBe(1);
    expect(x.files.every((f) => f.inDependencyCycle)).toBe(true);
  });
});
