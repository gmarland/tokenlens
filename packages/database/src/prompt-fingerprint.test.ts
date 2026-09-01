import { describe, expect, it } from "vitest";
import { canonicalPromptText, promptFingerprint } from "./prompt-fingerprint";

describe("prompt fingerprinting", () => {
  it("normalizes line endings without changing meaningful whitespace or case", () => {
    expect(canonicalPromptText("Fix it\r\n  Now\r")).toBe("Fix it\n  Now\n");
    expect(promptFingerprint("Fix it\r\n  Now\r")).toBe(promptFingerprint("Fix it\n  Now\n"));
    expect(promptFingerprint("Fix it")).not.toBe(promptFingerprint("fix it"));
    expect(promptFingerprint("Fix it")).not.toBe(promptFingerprint("Fix it "));
  });
});
