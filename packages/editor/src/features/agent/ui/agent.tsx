import { newUuid } from "@keepcv/core";
import type { AgentAction } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext, useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { Dialog } from "../../../components/ui/dialog.js";
import type { ApiClient } from "../../../lib/api.js";
import { readEdit } from "../../../lib/edit-recovery.js";
import { useAgentController } from "../api/use-agent.js";
import { recoverFiles } from "../model/files.js";

const Context = createContext<ReturnType<typeof useAgentController> | null>(null);

export function AgentProvider({ api, children }: { api: ApiClient; children: ReactNode }) {
  const controller = useAgentController(api);
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
function useAgent() {
  const agent = useContext(Context);
  if (agent === null) throw new Error("Missing assistant context");
  return agent;
}

function Proposal({ action }: { action: AgentAction }) {
  const agent = useAgent();
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
      {action.status === "pending" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={agent.busy}
            tone="primary"
            onClick={() => {
              void agent.decide(action, true);
            }}
          >
            Accept
          </Button>
          <Button
            disabled={agent.busy}
            onClick={() => {
              void agent.decide(action, false);
            }}
          >
            Reject
          </Button>
          <Button onClick={() => setEditing(!editing)}>Request changes</Button>
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

function Conversation() {
  const agent = useAgent();
  const data = agent.conversation.data;
  return (
    <div className="space-y-5">
      {agent.uploaded.data?.length ? (
        <details className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-sm">Saved attachments</summary>
          <div className="mt-3 space-y-3">
            {agent.uploaded.data.map((file) => (
              <div key={file.id} className="flex flex-wrap items-center gap-2 text-xs">
                <label>
                  <input
                    type="checkbox"
                    disabled={agent.busy || file.archivedAt !== null}
                    checked={agent.selectedAttachments.includes(file.id)}
                    onChange={(event) =>
                      agent.setSelectedAttachments((values) =>
                        event.target.checked
                          ? [...values, file.id]
                          : values.filter((id) => id !== file.id),
                      )
                    }
                  />{" "}
                  Include {file.name}
                </label>
                <Button
                  size="sm"
                  onClick={() => {
                    void agent.downloadFile(file.id, file.name);
                  }}
                >
                  Download
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    void agent.archiveFile(file.id, file.updatedAt, file.archivedAt === null);
                  }}
                >
                  {file.archivedAt === null ? "Archive" : "Restore"}
                </Button>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {data?.messages.map((message) => (
        <article key={message.id} className="space-y-2 rounded-xl border border-line-subtle p-4">
          <p className="text-xs font-medium text-text-muted">
            {message.role === "user" ? "You" : "KeepCV"}
            {message.state === "interrupted" ? " - interrupted" : ""}
          </p>
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
          {message.attachmentIds.map((fileId) => (
            <span key={fileId} className="block text-xs text-text-muted">
              Attachment: {agent.uploaded.data?.find((file) => file.id === fileId)?.name ?? fileId}
            </span>
          ))}
          {message.sources.map((source, index) => (
            <p key={`${source.title}-${String(index)}`} className="text-sm">
              {source.url !== undefined && /^https?:\/\//.test(source.url) ? (
                <a href={source.url} target="_blank" rel="noreferrer" className="underline">
                  {source.title}
                </a>
              ) : (
                source.title
              )}
            </p>
          ))}
          {message.navigation !== null &&
          /^\/(?:overview|profile|records|points|tags|sections|role-profiles|templates|resumes|data|import|search)(?:\/[a-zA-Z0-9-]+)?$/.test(
            message.navigation,
          ) ? (
            <Link
              className="text-sm text-brand underline"
              to={message.navigation}
              onClick={() => agent.setOpen(false)}
            >
              Open {message.navigation}
            </Link>
          ) : null}
        </article>
      ))}
      {agent.partial ? (
        <article className="whitespace-pre-wrap rounded-xl bg-surface-sunken p-4">
          {agent.partial}
        </article>
      ) : null}
      {data?.actions.map((action) => (
        <Proposal key={action.id} action={action} />
      ))}
    </div>
  );
}

function Composer() {
  const agent = useAgent();
  return (
    <form
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (agent.files.length + event.dataTransfer.files.length <= 5)
          agent.changeFiles([
            ...agent.files,
            ...Array.from(event.dataTransfer.files).map((file) => ({ id: newUuid(), file })),
          ]);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void agent.send();
      }}
      className="space-y-3 rounded-xl border border-line bg-surface p-4"
    >
      <label htmlFor="agent-message" className="block text-sm font-medium">
        What would you like to do?
      </label>
      <textarea
        id="agent-message"
        value={agent.text}
        onChange={(event) => agent.changeText(event.target.value)}
        maxLength={32000}
        rows={4}
        className="w-full resize-y rounded-lg border border-line bg-canvas p-3 text-sm"
        placeholder="Find relevant Points, improve wording, or help compose a resume..."
      />
      <details
        className="rounded-lg border border-line-subtle p-3"
        open={agent.files.length > 0 || undefined}
      >
        <summary className="cursor-pointer text-sm text-text-muted">
          Attach files{agent.files.length ? ` (${String(agent.files.length)})` : ""}
        </summary>
        <fieldset aria-label="Attachments" className="mt-3 space-y-2">
          <label className="block text-xs text-text-muted">
            Attach PDF, PNG, JPEG, WebP or UTF-8 text (up to five files)
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.asc,.ascii,.md,.csv,.tsv,.json,.yaml,.yml,.log"
              className="mt-2 block w-full text-xs"
              onChange={(event) => {
                const incoming = Array.from(event.target.files ?? []);
                if (agent.files.length + incoming.length > 5)
                  agent.setError("Choose at most five files.");
                else
                  agent.changeFiles([
                    ...agent.files,
                    ...incoming.map((file) => ({ id: newUuid(), file })),
                  ]);
                event.target.value = "";
              }}
            />
          </label>
          {agent.files.map((file) => (
            <div key={file.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate">
                {file.file.name} ({Math.ceil(file.file.size / 1024)} KiB)
              </span>
              <Button
                size="sm"
                label={`Remove ${file.file.name}`}
                onClick={() => agent.changeFiles(agent.files.filter((row) => row.id !== file.id))}
              >
                Remove
              </Button>
            </div>
          ))}
        </fieldset>
      </details>
      <details className="text-sm text-text-muted" open={agent.publicQuery ? true : undefined}>
        <summary className="cursor-pointer">Research the web</summary>
        <label className="mt-3 block text-xs text-text-muted">
          Optional public research query (only this exact query may be sent to web search)
          <input
            value={agent.publicQuery}
            maxLength={500}
            onChange={(event) => agent.setPublicQuery(event.target.value)}
            className="mt-1 w-full rounded border border-line bg-canvas p-2"
          />
        </label>
      </details>
      <label className="flex items-start gap-2 text-xs text-text-muted">
        <input
          type="checkbox"
          checked={agent.disclosed}
          onChange={(event) => agent.setDisclosed(event.target.checked)}
        />
        I allow the assistant to send this conversation, selected attachments and relevant career
        data to the configured model services.
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          tone="primary"
          disabled={
            agent.busy ||
            agent.capabilities.data?.available !== true ||
            !agent.disclosed ||
            (!agent.text.trim() &&
              agent.files.length === 0 &&
              agent.selectedAttachments.length === 0)
          }
          pending={agent.busy}
        >
          Send
        </Button>
        {agent.busy ? (
          <Button
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
            Stop
          </Button>
        ) : null}
      </div>
      <details className="text-xs text-text-muted" open={agent.grant || undefined}>
        <summary className="cursor-pointer">Model services, permissions and recovery</summary>
        <p className="mt-3">{agent.capabilities.data?.disclosure}</p>
        <p className="mt-2">Changes require review unless you grant task access.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {/^\/(records|points|resumes)\/[a-f0-9-]{36}/.test(agent.path) ? (
            <Button
              onClick={() => {
                void agent.authorize();
              }}
            >
              {agent.grant ? "Revoke task edits" : "Allow edits to this resource"}
            </Button>
          ) : null}
          <Button
            onClick={() => {
              const saved = readEdit(agent.recoveryKey);
              if (typeof saved === "string") agent.changeText(saved);
              void recoverFiles(agent.recoveryKey)
                .then(agent.changeFiles)
                .catch(() => agent.setError("Browser attachment recovery is unavailable."));
            }}
          >
            Recover unsent input
          </Button>
        </div>
        {agent.grant ? (
          <p className="text-xs text-text-muted">
            Ordinary edits to the authorized resource: up to five writes for ten minutes. Archive,
            restore and merges still require review.
          </p>
        ) : null}
      </details>
      {agent.busy ? (
        <p role="status" className="text-xs text-text-muted">
          {agent.status}
        </p>
      ) : null}
      {agent.error ? (
        <p role="alert" className="text-sm text-critical-text">
          {agent.error}
        </p>
      ) : null}
    </form>
  );
}

export function AgentHome() {
  const agent = useAgent();
  const available = agent.capabilities.data?.available === true;
  const workspace = (
    <div className="space-y-5">
      {agent.id !== null || (agent.conversations.data?.length ?? 0) > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">
            Conversation{" "}
            <select
              disabled={agent.busy}
              value={agent.id ?? ""}
              onChange={(event) => {
                agent.setId(event.target.value || null);
              }}
              className="ml-2 rounded-lg border border-line bg-surface p-2"
            >
              <option value="">New conversation</option>
              {agent.conversations.data?.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {conversation.title}
                  {conversation.archivedAt === null ? "" : " (archived)"}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={agent.busy} onClick={() => agent.setId(null)}>
            New
          </Button>
          {agent.conversation.data ? (
            <Button
              disabled={agent.busy}
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
      <Conversation />
      <Composer />
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold">Your career, in conversation</h1>
        <p className="mt-2 text-sm text-text-muted">
          Find what matters, review suggestions, and make changes together.
        </p>
      </div>
      {available ? (
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
            <div className="mt-4">{workspace}</div>
          </details>
        </>
      )}
    </div>
  );
}

export function AgentPanel() {
  const agent = useAgent();
  if (agent.path === "/") return null;
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
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <p className="text-xs text-text-muted">
              Use this conversation to work with the page you have open.
            </p>
            <Conversation />
            <Composer />
            <Link to="/" onClick={() => agent.setOpen(false)} className="text-sm underline">
              Open full conversation
            </Link>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
