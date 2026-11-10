export interface AgentTokenUsage {
  source: "provider" | "unknown";
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
}

export type AgentCompletion = "complete" | "failed" | "interrupted";
export type AgentUsageEvent =
  | {
      event: "external-tool";
      runId?: string;
      tool: "web_search" | "web_fetch";
      engine: string;
      admittedCalls: number;
      callId: string;
      requested: number | null;
      executed: number | null;
      outcome: AgentCompletion;
    }
  | {
      event: "call";
      runId?: string;
      callId: string;
      kind: "conversation" | "document" | "research";
      attempt: number;
      step: number;
      model: string;
      providers: readonly string[];
      outcome: AgentCompletion;
      usage: AgentTokenUsage;
    }
  | {
      event: "run";
      runId?: string;
      outcome: AgentCompletion;
    };
export type AgentUsageObserver = (event: AgentUsageEvent) => void | Promise<void>;

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? Object.fromEntries(Object.entries(value))
    : {};
}

export function tokenUsage(value?: unknown, sdk = false): AgentTokenUsage {
  const raw = object(sdk ? object(value)["raw"] : value);
  const count = (value: unknown) =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
  const input = object(raw["prompt_tokens_details"]);
  const output = object(raw["completion_tokens_details"]);
  const counts = {
    inputTokens: count(raw["prompt_tokens"]),
    outputTokens: count(raw["completion_tokens"]),
    totalTokens: count(raw["total_tokens"]),
    cachedInputTokens: count(input["cached_tokens"]),
    reasoningTokens: count(output["reasoning_tokens"]),
  };
  return {
    source: Object.values(counts).some((value) => value !== null) ? "provider" : "unknown",
    ...counts,
  };
}

export function errorUsage(error: unknown): AgentTokenUsage {
  const raw = object(error);
  for (let body of [raw["data"], raw["responseBody"], raw["body"], raw]) {
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = undefined;
      }
    }
    const usage = tokenUsage(object(body)["usage"]);
    if (usage.source === "provider") return usage;
  }
  return tokenUsage();
}

export function observe(observer: AgentUsageObserver | undefined, event: AgentUsageEvent): void {
  try {
    void Promise.resolve(observer?.(event)).catch(() => undefined);
  } catch {
    return;
  }
}
