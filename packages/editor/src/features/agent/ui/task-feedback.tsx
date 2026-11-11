import { Failure } from "../../../app/states.js";
import { Icon } from "../../../components/icon/icon.js";
import { useAgent } from "./context.js";

export function TaskFeedback() {
  const agent = useAgent();
  const run = agent.conversation.data?.run;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="flex items-center gap-2 text-xs text-text-subtle">
          {agent.busy || agent.deciding !== null ? <Icon name="pending" size="xs" /> : null}
          {agent.stopping
            ? "Requesting stop..."
            : agent.deciding !== null
              ? "Saving your decision..."
              : agent.busy
                ? agent.status || "Working on your request..."
                : agent.error
                  ? ""
                  : agent.status}
        </p>
      </div>
      {agent.error ? <Failure error={agent.failure} /> : null}
      {!agent.error &&
      !agent.busy &&
      run?.error &&
      agent.conversation.data?.messages.at(-1)?.text !== run.error ? (
        <Failure error={run.error} />
      ) : null}
      {agent.capabilities.isError ||
      agent.conversation.isError ||
      agent.conversations.isError ||
      agent.uploaded.isError ? (
        <Failure
          error={
            agent.capabilities.error ??
            agent.conversation.error ??
            agent.conversations.error ??
            agent.uploaded.error
          }
          retry={() => {
            void agent.capabilities.refetch();
            void agent.conversations.refetch();
            if (agent.id !== null) {
              void agent.conversation.refetch();
              void agent.uploaded.refetch();
            }
          }}
        />
      ) : null}
    </div>
  );
}
