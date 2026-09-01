import { createHash } from "node:crypto";

export const PROMPT_MATCHER_VERSION = 1;

export function canonicalPromptText(promptText: string) {
  return promptText.replace(/\r\n?/g, "\n");
}

export function promptFingerprint(promptText: string) {
  return createHash("sha256").update(canonicalPromptText(promptText), "utf8").digest("hex");
}
