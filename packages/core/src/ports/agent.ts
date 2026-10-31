import type { AgentConversation, AgentGrant, AgentTurn, Uuid } from "@keepcv/schema";
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
  capabilities: { available: boolean; disclosure: string; maxFileBytes: number };
  turn(
    ownerId: Uuid,
    conversationId: Uuid,
    input: AgentTurn,
    emit: (event: AgentEvent) => Promise<void>,
    signal: CancellationSignal,
  ): Promise<void>;
  decide(
    ownerId: Uuid,
    conversationId: Uuid,
    actionId: Uuid,
    accept: boolean,
  ): Promise<AgentConversation>;
  grant(ownerId: Uuid, conversationId: Uuid, grant: AgentGrant | null): void;
  cancel(ownerId: Uuid, conversationId: Uuid): void;
  close(): void;
}
