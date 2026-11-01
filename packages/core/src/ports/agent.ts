import type { AgentConversation, AgentGrant, AgentLimits, AgentTurn, Uuid } from "@keepcv/schema";
import type { CancellationSignal } from "./repositories.js";

export class AgentRefusalError extends Error {
  override readonly name = "AgentRefusalError";
  readonly status: 403 | 409 | 413 | 422 | 503;
  constructor(message: string, status: 403 | 409 | 413 | 422 | 503 = 422) {
    super(message);
    this.status = status;
  }
}

export interface AgentEvent {
  type: "text" | "status" | "error" | "done";
  text: string;
}

export interface AgentRuntime {
  capabilities: {
    available: boolean;
    disclosure: string;
    maxFileBytes: number;
  } & Partial<AgentLimits>;
  turn(
    ownerId: Uuid,
    conversationId: Uuid,
    input: AgentTurn,
    emit: (event: AgentEvent) => Promise<void>,
    signal: CancellationSignal,
    scope?: string,
  ): Promise<void>;
  decide(
    ownerId: Uuid,
    conversationId: Uuid,
    actionId: Uuid,
    accept: boolean,
    scope?: string,
  ): Promise<AgentConversation>;
  grant(ownerId: Uuid, conversationId: Uuid, grant: AgentGrant | null, scope?: string): void;
  cancel(ownerId: Uuid, conversationId: Uuid): boolean | void;
  close(): void;
}

export function hasRunningAgentLease(run: AgentConversation["run"], now: number): boolean {
  if (run?.state !== "running" || run.leaseUntil === undefined) return false;
  const remaining = Date.parse(run.leaseUntil) - now;
  return remaining > 0 && remaining <= 180000;
}
