import { describe, expect, it, vi } from "vitest";
import { InstructionFingerprint2026090100040 } from "./2026090100040-InstructionFingerprint";

describe("InstructionFingerprint2026090100040", () => {
  it("adds only an aggregate instruction fingerprint", async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    await new InstructionFingerprint2026090100040().up({ query } as any);
    expect(query).toHaveBeenCalledWith("ALTER TABLE repo_snapshots ADD COLUMN instruction_fingerprint text");
  });
});
