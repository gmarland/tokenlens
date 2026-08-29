import { describe, it, expect } from "vitest";
import { parseOtlp } from "./index";

const av = (key: string, v: any) => ({
  key,
  value: typeof v === "number" ? { intValue: String(v) } : { stringValue: v },
});
const record = (name: string, extra: any[] = []) => ({
  timeUnixNano: "1700000000000000000",
  attributes: [
    av("event.name", name),
    av("prompt.id", "p1"),
    av("session.id", "s1"),
    ...extra,
  ],
});

describe("OTLP parser", () => {
  it("flattens Claude records and ignores unknown events", () => {
    const got = parseOtlp({
      resourceLogs: [
        {
          resource: { attributes: [av("user.email", "dev@example.com")] },
          scopeLogs: [
            {
              logRecords: [
                record("claude_code.api_request", [
                  av("input_tokens", 10),
                  av("cache_read_tokens", 4),
                  av("event.sequence", 1),
                ]),
                record("other.event"),
              ],
            },
          ],
        },
      ],
    });
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({
      provider: "claude",
      kind: "api_request",
      promptId: "p1",
      inputTokens: 10,
      cacheReadTokens: 4,
    });
  });

  it("normalizes Codex response tokens without double-counting cache", () => {
    const got = parseOtlp({
      resourceLogs: [
        {
          resource: {
            attributes: [
              av("conversation.id", "thread-1"),
              av("model", "gpt-5.6-sol"),
            ],
          },
          scopeLogs: [
            {
              logRecords: [
                {
                  timeUnixNano: "1700000000000000000",
                  attributes: [
                    av("event.name", "codex.sse_event"),
                    av("event.kind", "response.completed"),
                    av("turn.id", "turn-1"),
                    av("input_token_count", 100),
                    av("cached_input_token_count", 60),
                    av("output_token_count", 20),
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({
      provider: "codex",
      kind: "api_request",
      promptId: "turn-1",
      sessionId: "thread-1",
      model: "gpt-5.6-sol",
      inputTokens: 40,
      cacheReadTokens: 60,
      cacheCreationTokens: 0,
      outputTokens: 20,
    });
    expect(got[0]).not.toHaveProperty("costUsd");
  });

  it("tolerates optional Claude fields", () =>
    expect(
      parseOtlp({
        resourceLogs: [
          { scopeLogs: [{ logRecords: [record("claude_code.user_prompt")] }] },
        ],
      }),
    ).toHaveLength(1));

  it("rejects malformed roots", () => expect(() => parseOtlp(null)).toThrow());
});
