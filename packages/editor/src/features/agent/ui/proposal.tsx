import type { AgentAction } from "@keepcv/schema";
import { useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { changedValues, operationLabel } from "../model/presentation.js";
import { useAgent } from "./context.js";

export function Proposal({
  action,
  readOnly = false,
}: {
  action: AgentAction;
  readOnly?: boolean;
}) {
  const agent = useAgent();
  const locked =
    agent.busy || agent.deciding !== null || agent.conversation.data?.archivedAt != null;
  const [editing, setEditing] = useState(false);
  const Container = action.status === "pending" ? "section" : "details";
  const Heading = action.status === "pending" ? "p" : "summary";
  return (
    <Container
      className="rounded-xl border border-line bg-surface p-4 space-y-3"
      aria-label="Proposed change"
    >
      <Heading className="cursor-pointer text-sm font-medium">
        {action.summary}
        {action.status !== "pending" ? ` - ${action.status}` : ""}
      </Heading>
      {action.status === "pending" ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-text-muted">
            Review needed - no changes saved yet
          </p>
          {action.operations.map((operation, index) => (
            <div key={`${operation.type}-${String(index)}`} className="space-y-2">
              <p className="text-sm font-medium">{operationLabel(operation)}</p>
              <dl className="max-h-48 space-y-1 overflow-auto text-sm">
                {changedValues(operation).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
                    <dt className="text-text-muted first-letter:uppercase">{key}</dt>
                    <dd className="whitespace-pre-wrap break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : null}
      <details>
        <summary className="cursor-pointer text-sm text-text-muted">
          Review exact changes and affected data
        </summary>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs">
          {JSON.stringify(action.operations, null, 2)}
        </pre>
        <p className="mt-3 text-sm">Current data</p>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs">{action.before}</pre>
      </details>
      {action.status === "pending" && !readOnly && agent.canGenerate ? (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={locked}
            pending={agent.deciding === action.id}
            tone="primary"
            onClick={() => {
              void agent.decide(action, true);
            }}
          >
            Accept
          </Button>
          <Button
            disabled={locked}
            onClick={() => {
              void agent.decide(action, false);
            }}
          >
            Reject
          </Button>
          <Button
            disabled={locked}
            onClick={() => {
              setEditing(true);
              if (!agent.text.trim())
                agent.changeText(
                  `Please revise this suggestion: ${action.summary}\n\nMy correction: `,
                );
              document.getElementById("agent-message")?.focus();
            }}
          >
            Request changes
          </Button>
        </div>
      ) : (
        <p className="text-sm text-text-muted">{action.receipt ?? action.status}</p>
      )}
      {editing ? (
        <p className="text-sm">
          Describe your correction in the message below. Reject this proposal before accepting its
          replacement.
        </p>
      ) : null}
    </Container>
  );
}
