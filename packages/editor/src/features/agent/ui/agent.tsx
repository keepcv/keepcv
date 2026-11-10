import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "../../../components/brand/logo.js";
import { Icon } from "../../../components/icon/icon.js";
import { Button } from "../../../components/ui/button.js";
import { Dialog } from "../../../components/ui/dialog.js";
import { Composer } from "./composer.js";
import { useAgent } from "./context.js";
import { Transcript } from "./conversation.js";
import { ConversationHistory } from "./history.js";
import { TaskFeedback } from "./task-feedback.js";

export { AgentProvider } from "./context.js";

function Welcome({ available }: { available: boolean }) {
  const agent = useAgent();
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-8 text-center">
      <Logo mark className="mb-6 h-12" />
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What are we working on?</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-text-muted">
        Find the right Points, shape a resume, or capture something new.
      </p>
      {available ? (
        <div className="mt-8 grid w-full gap-2 text-left sm:grid-cols-3">
          {[
            {
              icon: "record" as const,
              label: "Review my career",
              prompt: "Review my career records",
            },
            {
              icon: "resume" as const,
              label: "Shape a resume",
              prompt: "Choose Points for my resume",
            },
            {
              icon: "point" as const,
              label: "Capture a new Point",
              prompt: "Help me record a recent project",
            },
          ].map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              onClick={() => {
                agent.changeText(suggestion.prompt);
                document.getElementById("agent-message")?.focus();
              }}
              className="flex items-center gap-3 rounded-xl border border-line-subtle px-4 py-3 text-sm text-text-muted transition-colors hover:border-line hover:bg-surface hover:text-text sm:flex-col sm:items-start sm:gap-4"
            >
              <Icon name={suggestion.icon} size="md" className="text-text-subtle" />
              {suggestion.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 max-w-md space-y-3 text-sm text-text-muted">
          <p>{agent.capabilities.data?.disclosure ?? "Connecting to the assistant..."}</p>
          <Link to="/overview" className="font-medium text-text underline underline-offset-4">
            Open your store
          </Link>
        </div>
      )}
    </div>
  );
}

export function AgentHome({ historyOnly = false }: { historyOnly?: boolean }) {
  const agent = useAgent();
  const [history, setHistory] = useState(false);
  const available = agent.canGenerate && !historyOnly;
  const conversation = agent.conversation.data;
  const empty = agent.id === null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line-subtle px-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium">
            {historyOnly ? "Conversations" : (conversation?.title ?? "Assistant")}
          </h1>
          {conversation?.archivedAt != null ? (
            <p className="text-xs text-text-subtle">Archived conversation</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button tone="ghost" size="sm" icon="history" onClick={() => setHistory(true)}>
            History
          </Button>
          {conversation ? (
            <Button
              tone="ghost"
              size="sm"
              icon={conversation.archivedAt === null ? "archive" : "restore"}
              label={
                conversation.archivedAt === null ? "Archive conversation" : "Restore conversation"
              }
              disabled={agent.busy || agent.deciding !== null}
              onClick={() => void agent.archive(conversation)}
            />
          ) : null}
          {!historyOnly ? (
            <Button
              tone="ghost"
              size="sm"
              icon="add"
              label="New conversation"
              disabled={agent.busy || agent.deciding !== null}
              onClick={() => agent.setId(null)}
            />
          ) : null}
        </div>
      </header>

      {empty ? (
        historyOnly ? (
          <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col gap-4 px-5 py-8">
            <p className="text-sm text-text-muted">Your conversations, files and change history.</p>
            <ConversationHistory />
          </div>
        ) : (
          <Welcome available={available} />
        )
      ) : (
        <Transcript key={agent.id} readOnly={!available} />
      )}

      <div className="mx-auto w-full max-w-3xl shrink-0 space-y-2 px-4 pb-4 pt-2 sm:px-6 sm:pb-5">
        {agent.sourcePath ? (
          <div className="flex min-w-0 items-center gap-2 text-xs text-text-muted">
            <span className="shrink-0">Page context:</span>
            <Link to={agent.sourcePath} className="truncate underline" title={agent.sourcePath}>
              {agent.sourcePath}
            </Link>
            <Button
              tone="ghost"
              size="sm"
              icon="close"
              label="Remove page context"
              disabled={agent.busy || agent.deciding !== null}
              onClick={agent.clearPageContext}
            />
          </div>
        ) : null}
        <TaskFeedback />
        {agent.enabled && !historyOnly ? (
          available ? (
            <Composer />
          ) : (
            <details className="text-sm text-text-muted">
              <summary className="cursor-pointer">Unsent input and recovery</summary>
              <div className="mt-3">
                <Composer />
              </div>
            </details>
          )
        ) : null}
        {available ? (
          <p className="text-center text-[0.6875rem] text-text-subtle">
            KeepCV AI can make mistakes. Review suggested changes before saving.
          </p>
        ) : null}
      </div>

      {history ? (
        <Dialog title="Conversation history" size="lg" onClose={() => setHistory(false)}>
          <div className="flex min-h-0 flex-col p-4">
            <ConversationHistory onChoose={() => setHistory(false)} />
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

export function AskKeepCV() {
  const agent = useAgent();
  const navigate = useNavigate();
  if (!agent.enabled || ["/", "/assistant", "/conversations"].includes(agent.path)) return null;
  return (
    <Button
      className="fixed bottom-4 right-4 z-30 shadow-card"
      size="sm"
      tone="secondary"
      icon="conversation"
      disabled={agent.busy || agent.deciding !== null}
      onClick={() => {
        agent.startFromPage();
        void navigate({ to: "/assistant" });
      }}
    >
      Ask KeepCV
    </Button>
  );
}
