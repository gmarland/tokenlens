import { describe, expect, it, vi } from "vitest";
import type { QueryRunner } from "typeorm";
import { PromptBenchmarks2026090100010 } from "./2026090100010-PromptBenchmarks";

describe("prompt benchmark migration", () => {
  it("backfills fingerprints and creates benchmark matching indexes", async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    await new PromptBenchmarks2026090100010().up({ query } as unknown as QueryRunner);
    const sql = String(query.mock.calls[0][0]).replace(/\s+/g, " ");

    expect(sql).toContain("ADD COLUMN prompt_fingerprint text");
    expect(sql).toContain("sha256(convert_to");
    expect(sql).toContain("CREATE TABLE prompt_benchmarks");
    expect(sql).toContain("prompt_benchmark_active_match_uq");
  });

  it("removes benchmark storage and prompt fingerprints on rollback", async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    await new PromptBenchmarks2026090100010().down({ query } as unknown as QueryRunner);
    const sql = String(query.mock.calls[0][0]).replace(/\s+/g, " ");

    expect(sql).toContain("DROP TABLE prompt_benchmarks");
    expect(sql).toContain("ALTER TABLE prompts DROP COLUMN prompt_fingerprint");
  });
});
