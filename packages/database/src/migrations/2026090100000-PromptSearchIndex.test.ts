import { describe, expect, it, vi } from "vitest";
import type { QueryRunner } from "typeorm";
import { PromptSearchIndex2026090100000 } from "./2026090100000-PromptSearchIndex";

describe("prompt search index migration", () => {
  it("enables trigram search and creates a partial prompt-text index", async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new PromptSearchIndex2026090100000();

    await migration.up({ query } as unknown as QueryRunner);

    expect(query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, " ").trim())).toEqual([
      "CREATE EXTENSION IF NOT EXISTS pg_trgm",
      "CREATE INDEX IF NOT EXISTS prompt_text_trgm_idx ON prompts USING gin (prompt_text gin_trgm_ops) WHERE prompt_text IS NOT NULL",
    ]);
  });

  it("drops only the index on rollback", async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new PromptSearchIndex2026090100000();

    await migration.down({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenCalledWith("DROP INDEX IF EXISTS prompt_text_trgm_idx");
  });
});
