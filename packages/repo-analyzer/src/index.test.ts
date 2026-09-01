import { describe, it, expect } from "vitest";
import { normalizeRemote, analyzeCommits, analyzeRepository } from "./index";
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
    const fingerprint = x.metrics.instructionFingerprint;
    await writeFile(path.join(root, "AGENTS.md"), "# Different instructions!\n");
    const changed = await analyzeRepository(root);
    expect(changed.metrics.agentsMdTotalBytes).toBe(x.metrics.agentsMdTotalBytes);
    expect(changed.metrics.instructionFingerprint).not.toBe(fingerprint);
    expect(x.metrics.dependencyGraphEdges).toBe(2);
    expect(x.metrics.dependencyCycleCount).toBe(1);
    expect(x.files.every((f) => f.inDependencyCycle)).toBe(true);
  });
});

describe("commit analysis", () => {
  it("captures author and committer identities without commit messages", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "tokenlens-commits-"));
    await exec("git", ["init", "-q", root]);
    await writeFile(path.join(root, "index.ts"), "export const value = 1;\n");
    await exec("git", ["-C", root, "add", "."]);
    await exec("git", ["-C", root, "commit", "-q", "-m", "private message"], {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Ada Author",
        GIT_AUTHOR_EMAIL: "ada@example.com",
        GIT_AUTHOR_DATE: "2026-08-30T12:00:00+02:00",
        GIT_COMMITTER_NAME: "Chris Committer",
        GIT_COMMITTER_EMAIL: "chris@example.com",
        GIT_COMMITTER_DATE: "2026-08-30T13:00:00+02:00",
      },
    });

    const commits = await analyzeCommits(root);

    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({
      authorName: "Ada Author",
      authorEmail: "ada@example.com",
      authoredAt: "2026-08-30T10:00:00.000Z",
      committerName: "Chris Committer",
      committerEmail: "chris@example.com",
      committedAt: "2026-08-30T11:00:00.000Z",
    });
    expect(commits[0]).not.toHaveProperty("message");
  });
});
