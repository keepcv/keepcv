import { Link } from "@tanstack/react-router";
import { Button } from "../../../components/ui/button.js";
import { Dialog } from "../../../components/ui/dialog.js";
import { words } from "../model/presentation.js";
import { Composer } from "./composer.js";
import { useAgent } from "./context.js";
import { Transcript } from "./conversation.js";
import { TaskFeedback } from "./task-feedback.js";

export { AgentProvider } from "./context.js";

export function AgentHome({ historyOnly = false }: { historyOnly?: boolean }) {
  const agent = useAgent();
  const available = agent.canGenerate && !historyOnly;
  const workspace = (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {agent.id !== null || (agent.conversations.data?.length ?? 0) > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">
            Conversation{" "}
            <select
              disabled={agent.busy || agent.deciding !== null}
              value={agent.id ?? ""}
              onChange={(event) => {
                agent.setId(event.target.value || null);
              }}
              className="ml-2 rounded-lg border border-line bg-surface p-2"
            >
              <option value="">{available ? "New conversation" : "Choose a conversation"}</option>
              {agent.conversations.data?.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {conversation.title}
                  {conversation.archivedAt === null ? "" : " (archived)"}
                </option>
              ))}
            </select>
          </label>
          {available ? (
            <Button
              disabled={agent.busy || agent.deciding !== null}
              onClick={() => agent.setId(null)}
            >
              New
            </Button>
          ) : null}
          {agent.conversation.data ? (
            <Button
              disabled={agent.busy || agent.deciding !== null}
              onClick={() => {
                if (agent.conversation.data !== undefined)
                  void agent.archive(agent.conversation.data);
              }}
            >
              {agent.conversation.data.archivedAt === null
                ? "Archive conversation"
                : "Restore conversation"}
            </Button>
          ) : null}
        </div>
      ) : null}
      {historyOnly &&
      !agent.conversations.isPending &&
      !agent.conversations.isError &&
      (agent.conversations.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-text-muted">No saved conversations yet.</p>
      ) : null}
      {historyOnly && agent.canGenerate && agent.conversation.data?.archivedAt === null ? (
        <Link to="/assistant" className="text-xs underline">
          Continue conversation
        </Link>
      ) : null}
      <Transcript key={agent.id ?? "new"} readOnly={!available} />
      <TaskFeedback />
      {agent.enabled && !historyOnly ? <Composer /> : null}
    </div>
  );
  return (
    <div className="mx-auto flex h-full min-h-[32rem] max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {historyOnly ? "Conversations" : "Your career, in conversation"}
        </h1>
        {agent.id === null || historyOnly ? (
          <p className="mt-2 text-sm text-text-muted">
            {historyOnly
              ? "Read your saved conversations and download their original attachments."
              : "An AI assistant for your KeepCV data. Check suggestions before applying changes."}
          </p>
        ) : null}
      </div>
      {historyOnly ? (
        workspace
      ) : available ? (
        <>
          {agent.id === null ? (
            <div className="flex flex-wrap gap-2">
              {[
                "Choose Points for my resume",
                "Review my career records",
                "Explain versions and snapshots",
              ].map((task) => (
                <Button key={task} size="sm" tone="ghost" onClick={() => agent.changeText(task)}>
                  {task}
                </Button>
              ))}
            </div>
          ) : null}
          {workspace}
        </>
      ) : (
        <>
          <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
            <p className="text-sm text-text-muted">
              {agent.capabilities.data?.disclosure ??
                (agent.capabilities.isError
                  ? "The assistant is unavailable on this server."
                  : "Connecting to the assistant...")}
            </p>
            <Link to="/overview" className="text-sm font-medium underline">
              Open your store
            </Link>
          </div>
          <details className="text-sm text-text-muted">
            <summary className="cursor-pointer">Conversations and unsent input</summary>
            <div className="mt-4 flex min-h-[32rem] flex-col">{workspace}</div>
          </details>
        </>
      )}
    </div>
  );
}

export function AgentPanel() {
  const agent = useAgent();
  if (
    !agent.enabled ||
    agent.path === "/" ||
    agent.path === "/assistant" ||
    agent.path === "/conversations"
  )
    return null;
  return (
    <>
      <Button
        className="fixed bottom-4 right-4 z-30 shadow-card"
        size="sm"
        tone="secondary"
        onClick={() => agent.setOpen(true)}
      >
        Ask KeepCV
      </Button>
      {agent.open ? (
        <Dialog title="Ask KeepCV" size="lg" onClose={() => agent.setOpen(false)}>
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            <p className="text-xs text-text-muted">
              Use this conversation to work with the page you have open.
            </p>
            <p className="text-xs text-text-muted">
              This page: {words(agent.path.split("/")[1] || "overview")}
            </p>
            <Transcript key={agent.id ?? "new"} />
            <TaskFeedback />
            <Composer />
            <Link
              to="/assistant"
              onClick={() => agent.setOpen(false)}
              className="text-sm underline"
            >
              Open full conversation
            </Link>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
