import type { Provider } from "@tokenlens/shared";

type AnyRecord = Record<string, any>;

const value = (v: any): any => {
  if (!v || typeof v !== "object") return v;
  for (const k of ["stringValue", "intValue", "doubleValue", "boolValue"])
    if (k in v) return k === "intValue" ? Number(v[k]) : v[k];
  if (v.arrayValue) return (v.arrayValue.values ?? []).map(value);
  if (v.kvlistValue) return attrs(v.kvlistValue.values ?? []);
  return undefined;
};

const attrs = (a: any[]): AnyRecord =>
  Object.fromEntries(
    (a ?? []).filter((x) => x?.key).map((x) => [x.key, value(x.value)]),
  );
const pick = (a: AnyRecord, ...keys: string[]) => {
  for (const k of keys) if (a[k] !== undefined) return a[k];
};
const num = (x: any) => Number(x ?? 0) || 0;
const optionalNum = (x: any) => {
  if (x === undefined || x === null || x === "") return undefined;
  const parsed = Number(x);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const str = (x: any) => (x == null ? undefined : String(x));

function recordTimeUnixNano(record: AnyRecord): bigint {
  for (const candidate of [record.timeUnixNano, record.observedTimeUnixNano]) {
    try {
      const nanos = BigInt(candidate);
      if (nanos > 0n) return nanos;
    } catch {
      // Try the next timestamp before falling back to receipt time.
    }
  }
  return BigInt(Date.now()) * 1_000_000n;
}

export type User = {
  externalId?: string;
  accountId?: string;
  accountUuid?: string;
  anonymousId?: string;
  email?: string;
};

type Base = {
  provider: Provider;
  promptId: string;
  sessionId?: string;
  sequence: string;
  timestamp: Date;
  model?: string;
  user?: User;
};

export type NormalizedAgentEvent =
  | (Base & { kind: "user_prompt" })
  | (Base & {
      kind: "api_request";
      requestId?: string;
      querySource?: string;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheCreationTokens: number;
      cacheMetricsAvailable: boolean;
      costUsd?: number;
      durationMs: number;
    })
  | (Base & {
      kind: "tool_result";
      toolUseId: string;
      toolName?: string;
      success?: boolean;
      durationMs?: number;
      toolInputSizeBytes?: number;
      toolResultSizeBytes?: number;
    })
  | (Base & { kind: "api_error" });

// Backward-compatible alias for the package's original public type.
export type NormalizedClaudeEvent = NormalizedAgentEvent;

function baseFor(
  provider: Provider,
  a: AnyRecord,
  record: AnyRecord,
  fallbackSequence: number,
): Base | undefined {
  const sessionId = str(
    pick(
      a,
      "conversation.id",
      "conversation_id",
      "session.id",
      "session_id",
      "thread.id",
      "thread_id",
    ),
  );
  const promptId =
    str(pick(a, "turn.id", "turn_id", "prompt.id", "prompt_id")) ??
    sessionId;
  if (!promptId) return undefined;
  const nanos = recordTimeUnixNano(record);
  return {
    provider,
    promptId,
    sessionId,
    sequence:
      str(
        pick(
          a,
          "event.sequence",
          "event_sequence",
          "response.id",
          "response_id",
          "request_id",
        ),
      ) ?? `${nanos}:${fallbackSequence}`,
    timestamp: new Date(Number(nanos / 1_000_000n)),
    model: str(pick(a, "model", "gen_ai.request.model")),
    user: {
      externalId: str(
        pick(
          a,
          "user.id",
          "user.email",
          "user.account_uuid",
          "user.account_id",
        ),
      ),
      accountId: str(pick(a, "user.account_id")),
      accountUuid: str(pick(a, "user.account_uuid")),
      anonymousId: str(pick(a, "user.id")),
      email: str(pick(a, "user.email")),
    },
  };
}

function parseClaude(
  name: string,
  a: AnyRecord,
  base: Base,
): NormalizedAgentEvent | undefined {
  if (name === "claude_code.api_request")
    return {
      ...base,
      kind: "api_request",
      requestId: str(pick(a, "request_id")),
      querySource: str(pick(a, "query_source")),
      inputTokens: num(a.input_tokens),
      outputTokens: num(a.output_tokens),
      cacheReadTokens: num(a.cache_read_tokens),
      cacheCreationTokens: num(a.cache_creation_tokens),
      cacheMetricsAvailable: true,
      costUsd: num(a.cost_usd),
      durationMs: num(a.duration_ms),
    };
  if (name === "claude_code.tool_result") {
    const toolUseId = str(pick(a, "tool_use_id"));
    if (!toolUseId) return;
    return {
      ...base,
      kind: "tool_result",
      toolUseId,
      toolName: str(a.tool_name),
      success: a.success === undefined ? undefined : Boolean(a.success),
      durationMs: optionalNum(a.duration_ms),
      toolInputSizeBytes: optionalNum(a.tool_input_size_bytes),
      toolResultSizeBytes: optionalNum(a.tool_result_size_bytes),
    };
  }
  if (name === "claude_code.user_prompt")
    return { ...base, kind: "user_prompt" };
  if (name === "claude_code.api_error")
    return { ...base, kind: "api_error" };
}

function parseCodex(
  name: string,
  a: AnyRecord,
  base: Base,
): NormalizedAgentEvent | undefined {
  const eventKind = str(pick(a, "event.kind", "event_kind", "kind"));
  if (
    (name === "codex.sse_event" || name === "codex.websocket_event") &&
    eventKind === "response.completed"
  ) {
    const totalInput = num(
      pick(a, "input_token_count", "input_tokens", "gen_ai.usage.input_tokens"),
    );
    const cached = num(
      pick(
        a,
        "cached_token_count",
        "cached_input_token_count",
        "cached_input_tokens",
        "cached_tokens",
        "gen_ai.usage.cached_input_tokens",
      ),
    );
    const cacheWrite = num(
      pick(
        a,
        "cache_write_token_count",
        "cache_write_input_token_count",
        "cache_write_input_tokens",
        "cache_write_tokens",
        "gen_ai.usage.cache_write_input_tokens",
      ),
    );
    return {
      ...base,
      kind: "api_request",
      requestId: str(pick(a, "request_id", "response.id", "response_id")),
      querySource: "codex",
      // OpenAI cache reads and writes are subsets of input. Store only fresh
      // input in the additive TokenLens columns so their sum remains total input.
      inputTokens: Math.max(0, totalInput - cached - cacheWrite),
      outputTokens: num(
        pick(
          a,
          "output_token_count",
          "output_tokens",
          "gen_ai.usage.output_tokens",
        ),
      ),
      cacheReadTokens: cached,
      cacheCreationTokens: cacheWrite,
      cacheMetricsAvailable: true,
      durationMs: num(pick(a, "duration_ms", "duration.ms")),
    };
  }
  if (name === "codex.user_prompt")
    return { ...base, kind: "user_prompt" };
  if (name === "codex.api_request" && a.success === false)
    return { ...base, kind: "api_error" };
  if (name === "codex.tool_result") {
    const toolUseId =
      str(pick(a, "tool_use_id", "call_id", "tool.call.id")) ?? base.sequence;
    return {
      ...base,
      kind: "tool_result",
      toolUseId,
      toolName: str(pick(a, "tool_name", "tool", "gen_ai.tool.name")),
      success: a.success === undefined ? undefined : Boolean(a.success),
      durationMs: optionalNum(pick(a, "duration_ms", "duration.ms")),
      toolInputSizeBytes: optionalNum(a.tool_input_size_bytes),
      toolResultSizeBytes: optionalNum(
        pick(a, "tool_result_size_bytes", "output_size_bytes"),
      ),
    };
  }
}

export function parseOtlp(payload: unknown): NormalizedAgentEvent[] {
  if (!payload || typeof payload !== "object")
    throw new Error("OTLP payload must be an object");
  const out: NormalizedAgentEvent[] = [];
  for (const rl of (payload as any).resourceLogs ?? []) {
    const resource = attrs(rl.resource?.attributes);
    for (const sl of rl.scopeLogs ?? [])
      for (const record of sl.logRecords ?? []) {
        try {
          const a = { ...resource, ...attrs(record.attributes) };
          const body = value(record.body);
          if (body && typeof body === "object") Object.assign(a, body);
          const name =
            str(pick(a, "event.name", "name")) ??
            (typeof body === "string" ? body : undefined);
          const provider: Provider | undefined = name?.startsWith("claude_code.")
            ? "claude"
            : name?.startsWith("codex.")
              ? "codex"
              : undefined;
          if (!name || !provider) continue;
          const base = baseFor(provider, a, record, out.length);
          if (!base) continue;
          const event =
            provider === "claude"
              ? parseClaude(name, a, base)
              : parseCodex(name, a, base);
          if (event) out.push(event);
        } catch {
          // Malformed records are skipped without logging their bodies.
        }
      }
  }
  return out;
}
