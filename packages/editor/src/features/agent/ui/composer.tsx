import { newUuid } from "@keepcv/core";
import { useRef, useState } from "react";
import { Icon } from "../../../components/icon/icon.js";
import { Button } from "../../../components/ui/button.js";
import { readEdit } from "../../../lib/edit-recovery.js";
import { recoverFiles } from "../model/files.js";
import { useAgent } from "./context.js";

function fileSize(bytes: number) {
  if (bytes % (1024 * 1024) === 0) return String(bytes / (1024 * 1024)) + " MiB";
  if (bytes % 1024 === 0) return String(bytes / 1024) + " KiB";
  return String(bytes) + " bytes";
}

export function Composer() {
  const agent = useAgent();
  const fileInput = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState(false);
  const expanded = options || agent.grant || Boolean(agent.publicQuery);
  const disabled =
    agent.busy ||
    agent.deciding !== null ||
    agent.conversation.data?.archivedAt != null ||
    !agent.canGenerate ||
    !agent.disclosed ||
    (!agent.text.trim() && agent.files.length === 0 && agent.selectedAttachments.length === 0);

  function addFiles(files: File[]) {
    if (agent.files.length + files.length > (agent.capabilities.data?.maxAttachments ?? 5)) {
      agent.setError("Choose fewer files to fit the configured attachment limit.");
      return;
    }
    agent.changeFiles([...agent.files, ...files.map((file) => ({ id: newUuid(), file }))]);
  }

  return (
    <form
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        addFiles(Array.from(event.dataTransfer.files));
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void agent.send();
      }}
      className="max-h-[60dvh] shrink-0 overflow-y-auto rounded-2xl border border-line bg-surface-raised p-3 shadow-card transition-colors focus-within:border-line-strong"
    >
      {agent.files.length > 0 ? (
        <div className="mb-2 flex max-h-24 flex-wrap gap-2 overflow-y-auto">
          {agent.files.map((file) => (
            <span
              key={file.id}
              className="inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1 text-xs text-text-muted"
            >
              <Icon name="evidence" size="xs" />
              <span className="truncate">{file.file.name}</span>
              <Button
                tone="ghost"
                size="sm"
                icon="close"
                label={"Remove " + file.file.name}
                onClick={() => agent.changeFiles(agent.files.filter((row) => row.id !== file.id))}
              />
            </span>
          ))}
        </div>
      ) : null}
      <label htmlFor="agent-message" className="sr-only">
        What would you like to do?
      </label>
      <textarea
        id="agent-message"
        value={agent.text}
        onChange={(event) => agent.changeText(event.target.value)}
        maxLength={agent.capabilities.data?.maxTextCharacters ?? 32000}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            (event.ctrlKey || event.metaKey) &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        aria-describedby="agent-composer-help"
        rows={2}
        className="block max-h-40 min-h-16 w-full resize-none bg-transparent px-1 py-1 text-sm leading-6 placeholder:text-text-subtle"
        placeholder="Ask KeepCV, or add something to your career..."
      />
      <div className="flex items-center justify-between gap-2 pt-2">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            tone="ghost"
            icon="evidence"
            label="Attach files"
            onClick={() => fileInput.current?.click()}
          />
          <input
            ref={fileInput}
            type="file"
            multiple
            aria-label="Choose attachments"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.asc,.ascii,.md,.csv,.tsv,.json,.yaml,.yml,.log"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <Button
            tone="ghost"
            size="sm"
            icon={agent.grant ? "confirm" : "private"}
            expanded={expanded}
            onClick={() => setOptions(!expanded)}
          >
            {agent.grant ? "Task edits on" : "Review before saving"}
          </Button>
          <Button
            tone="ghost"
            size="sm"
            icon="settings"
            label="Conversation settings"
            expanded={expanded}
            onClick={() => setOptions(!expanded)}
          />
        </div>
        {agent.busy ? (
          <Button
            tone="secondary"
            icon="stop"
            label="Stop task"
            pending={agent.stopping}
            onClick={() =>
              void agent
                .stop()
                .catch((reason: unknown) =>
                  agent.setError(
                    reason instanceof Error
                      ? reason.message
                      : "Stop could not be acknowledged. Reopen the conversation to check its status.",
                  ),
                )
            }
          />
        ) : (
          <button
            type="submit"
            aria-label="Send"
            title="Send (Ctrl/Cmd+Enter)"
            disabled={disabled}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-text text-text-inverted transition-opacity hover:opacity-80 disabled:opacity-30"
          >
            <Icon name="moveUp" size="md" />
          </button>
        )}
      </div>
      <div
        id="agent-composer-help"
        className="mt-2 flex items-start justify-between gap-3 border-t border-line-subtle px-1 pt-2 text-[0.6875rem] leading-4 text-text-subtle"
      >
        <label className="flex min-w-0 items-start gap-2">
          <input
            type="checkbox"
            checked={agent.disclosed}
            onChange={(event) => agent.setDisclosed(event.target.checked)}
            className="mt-0.5"
          />
          Share chat, selected files and relevant career data with model services.
        </label>
        <span className="hidden shrink-0 sm:block">Ctrl/Cmd+Enter</span>
      </div>
      {expanded ? (
        <section
          aria-label="Conversation settings"
          className="mt-3 max-h-[28dvh] space-y-4 overflow-y-auto border-t border-line-subtle px-1 pt-3 text-xs leading-5 text-text-muted"
        >
          <div>
            <p className="font-medium text-text">Model services</p>
            <p className="mt-1">{agent.capabilities.data?.disclosure}</p>
          </div>
          {agent.canGenerate &&
          /^\/(records|points|resumes)\/[a-f0-9-]{36}/.test(agent.contextPath) ? (
            <div className="space-y-2 rounded-lg border border-line-subtle p-3">
              <p className="font-medium text-text">Task edit permission</p>
              <p>Current resource only. Up to 5 edits for 10 minutes.</p>
              <p>Archive, restore and merges still need review.</p>
              <Button
                size="sm"
                icon={agent.grant ? "private" : "confirm"}
                onClick={() => void agent.authorize()}
              >
                {agent.grant ? "Revoke task edits" : "Allow task edits"}
              </Button>
            </div>
          ) : null}
          <div>
            <p className="font-medium text-text">Attachments</p>
            <p>
              PDF, PNG, JPEG, WebP or UTF-8 text. Up to{" "}
              {agent.capabilities.data?.maxAttachments ?? 5} files;{" "}
              {fileSize(agent.capabilities.data?.maxFileBytes ?? 16777216)} per file,{" "}
              {fileSize(agent.capabilities.data?.maxTextFileBytes ?? 1048576)} for text;{" "}
              {fileSize(agent.capabilities.data?.maxTurnBytes ?? 33554432)} per turn.
            </p>
          </div>
          <label className="block">
            <span className="font-medium text-text">Optional public research query</span>
            <input
              value={agent.publicQuery}
              maxLength={500}
              onChange={(event) => agent.setPublicQuery(event.target.value)}
              placeholder="Only this exact query may be sent to web search"
              className="mt-1 block w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs"
            />
          </label>
          <Button
            size="sm"
            tone="ghost"
            icon="restore"
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
        </section>
      ) : null}
    </form>
  );
}
