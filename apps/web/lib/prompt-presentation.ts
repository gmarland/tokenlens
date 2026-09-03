const IDE_CONTEXT_HEADING = "# Context from my IDE setup:";
const IDE_REQUEST_HEADING = "## My request:";

export type PromptPresentation = {
  rawText: string;
  requestText: string;
  hasIdeContext: boolean;
};

export function parsePromptPresentation(promptText: string): PromptPresentation {
  const normalized = promptText.replace(/\r\n?/g, "\n");
  if (!normalized.startsWith(IDE_CONTEXT_HEADING)) {
    return { rawText: promptText, requestText: promptText.trim(), hasIdeContext: false };
  }

  const requestHeading = new RegExp(`^${IDE_REQUEST_HEADING}[ \\t]*$`, "m").exec(normalized);
  if (!requestHeading) {
    return { rawText: promptText, requestText: promptText.trim(), hasIdeContext: false };
  }

  return {
    rawText: promptText,
    requestText: normalized.slice(requestHeading.index + requestHeading[0].length).trim(),
    hasIdeContext: true,
  };
}

export function promptTitle(promptText: string, maxLength: number, fallback = "Prompt") {
  const title = parsePromptPresentation(promptText).requestText.replace(/\s+/g, " ").trim();
  return title.slice(0, maxLength) || fallback;
}
