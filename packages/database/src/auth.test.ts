import { describe, expect, it } from "vitest";
import { generateApiKey, hashKey } from "./auth";

describe("workspace API keys", () => {
  it("generates recognizable high-entropy secrets while exposing only a display prefix", () => {
    const key = generateApiKey();
    expect(key.secret).toMatch(/^tlk_live_[A-Za-z0-9_-]{40,}$/);
    expect(key.hash).toBe(hashKey(key.secret));
    expect(key.prefix).not.toContain(key.secret);
    expect(key.prefix).toContain("tlk_live_");
  });
});
