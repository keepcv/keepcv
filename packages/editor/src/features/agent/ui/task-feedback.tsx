import { Button } from "../../../components/ui/button.js";
import { useAgent } from "./context.js";

export function TaskFeedback() {
  const agent = useAgent();
  const run = agent.conversation.data?.run;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-text-muted">
          {agent.stopping
            ? "Requesting stop..."
            : agent.deciding !== null
              ? "Saving your decision..."
              : agent.busy
                ? agent.status || "Working on your request..."
                : agent.status}
        </p>
        {agent.busy ? (
          <Button
            size="sm"
            pending={agent.stopping}
            onClick={() => {
              void agent
                .stop()
                .catch(() =>
                  agent.setError(
                    "Stop could not be acknowledged. Reopen the conversation to check its status.",
                  ),
                );
            }}
          >
            Stop task
          </Button>
        ) : null}
      </div>
      {agent.error ? (
        <p role="alert" className="text-sm text-critical-text">
          {agent.error}
        </p>
      ) : null}
      {!agent.error && !agent.busy && run?.error ? (
        <p className="text-sm text-text-muted">{run.error}</p>
      ) : null}
      {agent.conversation.isError || agent.conversations.isError || agent.uploaded.isError ? (
        <p role="alert" className="text-sm text-critical-text">
          Conversation data could not be loaded.{" "}
          <Button
            size="sm"
            onClick={() => {
              void agent.conversations.refetch();
              if (agent.id !== null) {
                void agent.conversation.refetch();
                void agent.uploaded.refetch();
              }
            }}
          >
            Try loading again
          </Button>
        </p>
      ) : null}
    </div>
  );
}
