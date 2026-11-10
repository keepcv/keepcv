import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { useAgent } from "./context.js";
import { MessageText } from "./message-text.js";
import { Proposal } from "./proposal.js";
import { ToolActivity } from "./tool-activity.js";

function Conversation({ readOnly = false }: { readOnly?: boolean }) {
  const agent = useAgent();
  const data = agent.conversation.data;
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      agent.setStatus("Response copied.");
    } catch {
      agent.setError("The response could not be copied. Select its text to copy it manually.");
    }
  }
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      {agent.uploaded.data?.length ? (
        <details className="rounded-xl border border-line-subtle px-3 py-2">
          <summary className="cursor-pointer text-xs text-text-muted">Saved attachments</summary>
          <div className="mt-3 space-y-3">
            {agent.uploaded.data.map((file) => (
              <div key={file.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span>
                  {!readOnly && agent.canGenerate ? (
                    <input
                      type="checkbox"
                      aria-label={`Include ${file.name}`}
                      disabled={
                        readOnly || !agent.canGenerate || agent.busy || file.archivedAt !== null
                      }
                      checked={agent.selectedAttachments.includes(file.id)}
                      onChange={(event) =>
                        agent.setSelectedAttachments((values) =>
                          event.target.checked
                            ? [...values, file.id]
                            : values.filter((id) => id !== file.id),
                        )
                      }
                    />
                  ) : null}{" "}
                  {!readOnly && agent.canGenerate ? "Include " : ""}
                  {file.name}
                </span>
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
      <div
        role="log"
        aria-label="Conversation messages"
        aria-relevant="additions"
        className="space-y-5"
      >
        {data?.messages.map((message) => (
          <article
            key={message.id}
            className={
              message.role === "user"
                ? "ml-auto w-fit max-w-[90%] space-y-2 rounded-2xl bg-surface-sunken px-4 py-3"
                : "min-w-0 space-y-3 py-2"
            }
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-text-muted">
                {message.role === "user" ? "You" : "KeepCV AI"}
                {message.state === "interrupted" ? " - interrupted" : ""}
              </p>
              {message.role === "assistant" ? (
                <Button
                  tone="ghost"
                  size="sm"
                  label={copied === message.id ? "Copied response" : "Copy response"}
                  onClick={() => {
                    void copy(message.id, message.text);
                  }}
                >
                  {copied === message.id ? "Copied" : "Copy"}
                </Button>
              ) : null}
            </div>
            <ToolActivity calls={message.toolCalls ?? []} />
            {message.role === "assistant" ? (
              <MessageText text={message.text} />
            ) : (
              <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
            )}
            {message.attachmentIds.map((fileId) => (
              <span key={fileId} className="block text-xs text-text-muted">
                Attachment:{" "}
                {agent.uploaded.data?.find((file) => file.id === fileId)?.name ?? fileId}
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
              <Link className="text-sm text-brand underline" to={message.navigation}>
                Open {message.navigation}
              </Link>
            ) : null}
          </article>
        ))}
      </div>
      {agent.partial || agent.toolCalls.length > 0 ? (
        <article aria-label="Response in progress" aria-live="off" className="space-y-2 py-2">
          <p className="text-xs font-medium text-text-muted">KeepCV AI - responding</p>
          <ToolActivity calls={agent.toolCalls} />
          <MessageText text={agent.partial} />
        </article>
      ) : null}
      {data?.actions.map((action) => (
        <Proposal key={action.id} action={action} readOnly={readOnly} />
      ))}
    </div>
  );
}

export function Transcript({ readOnly = false }: { readOnly?: boolean }) {
  const viewport = useRef<HTMLElement>(null);
  const following = useRef(true);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (following.current && viewport.current !== null)
      viewport.current.scrollTop = viewport.current.scrollHeight;
  });
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <section
        ref={viewport}
        aria-label="Conversation transcript"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard scroll target.
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onScroll={(event) => {
          const element = event.currentTarget;
          following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
          setPaused(!following.current);
        }}
      >
        <Conversation readOnly={readOnly} />
      </section>
      {paused ? (
        <div className="absolute inset-x-0 bottom-2 flex justify-center">
          <Button
            size="sm"
            onClick={() => {
              following.current = true;
              setPaused(false);
              if (viewport.current !== null)
                viewport.current.scrollTop = viewport.current.scrollHeight;
            }}
          >
            Jump to latest
          </Button>
        </div>
      ) : null}
    </div>
  );
}
