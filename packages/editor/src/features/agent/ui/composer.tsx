import { newUuid } from "@keepcv/core";
import { useRef, useState } from "react";
import { Icon } from "../../../components/icon/icon.js";
import { Button } from "../../../components/ui/button.js";
import { Dialog } from "../../../components/ui/dialog.js";
import { Menu, MenuItem } from "../../../components/ui/menu.js";
import { readEdit } from "../../../lib/edit-recovery.js";
import {
  generationAccept,
  generationFormats,
  generationMediaType,
  recoverFiles,
} from "../model/files.js";
import { useAgent } from "./context.js";

function fileSize(bytes: number) {
  if (bytes % (1024 * 1024) === 0) return `${bytes / (1024 * 1024)} MiB`;
  if (bytes % 1024 === 0) return `${bytes / 1024} KiB`;
  return `${bytes} bytes`;
}

export function Composer() {
  const agent = useAgent();
  const fileInput = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState(false);
  const disabled =
    agent.busy ||
    agent.deciding !== null ||
    agent.conversation.data?.archivedAt != null ||
    !agent.canGenerate ||
    (!agent.text.trim() && agent.files.length === 0 && agent.selectedAttachments.length === 0);
  const webAvailable = agent.capabilities.data?.webSearchAvailable === true;
  const mediaTypes = agent.capabilities.data?.generationMediaTypes ?? ["text/plain"];
  function addFiles(files: File[]) {
    if (
      files.some(
        (file) => !mediaTypes.includes(generationMediaType(file) as (typeof mediaTypes)[number]),
      )
    ) {
      agent.setError(
        "This file format is unavailable for generation. Your existing selections are retained.",
      );
      return;
    }
    if (agent.files.length + files.length > (agent.capabilities.data?.maxAttachments ?? 5)) {
      agent.setError("Choose fewer files to fit the configured attachment limit.");
      return;
    }
    agent.changeFiles([...agent.files, ...files.map((file) => ({ id: newUuid(), file }))]);
  }
  return (
    <>
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
        className="relative shrink-0 rounded-2xl border border-line bg-surface-raised p-3 shadow-card transition-colors focus-within:border-line-strong"
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
                  label={`Remove ${file.file.name}`}
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
          rows={2}
          className="block max-h-40 min-h-16 w-full resize-none bg-transparent px-1 py-1 text-sm leading-6 placeholder:text-text-subtle"
          placeholder="Ask KeepCV, or add something to your career..."
        />
        <input
          ref={fileInput}
          type="file"
          multiple
          aria-label="Choose attachments"
          accept={generationAccept(mediaTypes)}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <div className="sticky bottom-0 flex items-center justify-between gap-2 bg-surface-raised pt-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Menu label="Add files and tools" icon="add" placement="top-start">
              <MenuItem
                icon="evidence"
                onClick={() => fileInput.current?.click()}
                disabled={agent.busy}
              >
                Attach files
              </MenuItem>
              <MenuItem
                icon="search"
                checked={webAvailable && agent.webSearchEnabled}
                disabled={agent.busy || !agent.canGenerate || !webAvailable}
                onClick={() => agent.setWebSearchEnabled(!agent.webSearchEnabled)}
              >
                Web search{!webAvailable ? " (unavailable)" : ""}
              </MenuItem>
              <div className="my-1 border-t border-line-subtle" />
              <MenuItem icon="settings" onClick={() => setSettings(true)}>
                Conversation settings
              </MenuItem>
              <MenuItem
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
              </MenuItem>
            </Menu>
            {webAvailable && agent.webSearchEnabled ? (
              <button
                type="button"
                aria-label="Disable web search"
                disabled={agent.busy}
                onClick={() => agent.setWebSearchEnabled(false)}
                className="inline-flex h-7 items-center gap-1.5 rounded-full bg-brand-soft px-2.5 text-xs font-medium text-brand-text disabled:opacity-50"
              >
                <Icon name="search" size="xs" />
                Web search
                <Icon name="close" size="xs" />
              </button>
            ) : null}
            {agent.grant ? (
              <Button size="sm" tone="ghost" icon="confirm" onClick={() => setSettings(true)}>
                Task edits on
              </Button>
            ) : null}
          </div>
          {agent.busy ? (
            <Button
              tone="secondary"
              icon="stop"
              label="Stop task"
              pending={agent.stopping}
              onClick={() => void agent.stop().catch((reason: unknown) => agent.setError(reason))}
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
      </form>
      {agent.consent ? (
        <Dialog
          title="Share with the assistant"
          returnFocus={() => document.getElementById("agent-message")}
          describedBy="agent-sharing-scope"
          onClose={agent.closeConsent}
        >
          <div className="max-h-[60dvh] space-y-4 overflow-y-auto p-4 text-sm text-text-muted">
            <div id="agent-sharing-scope" className="space-y-3">
              <p>{agent.capabilities.data?.disclosure}</p>
              <p>
                Your message, conversation history, selected files and relevant career data read by
                the assistant are sent to the configured services. Stored private Evidence and
                drafts are excluded.
              </p>
              <p>Supported file inputs: {generationFormats(mediaTypes)}.</p>
              <p>
                {agent.files.length + agent.selectedAttachments.length} selected files or originals
                will be included. Sharing does not grant permission to edit your data.
              </p>
              <p>
                {webAvailable && agent.webSearchEnabled
                  ? "Web search is on. The assistant chooses search queries and page URLs that may reflect conversation information and shares them with the configured web services."
                  : "Web search is off. No web search or page fetch tools will be available for this request."}
              </p>
            </div>
            {webAvailable ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={agent.webSearchEnabled}
                  onChange={(event) => agent.setWebSearchEnabled(event.target.checked)}
                />
                Use Web search
              </label>
            ) : null}
            <p>
              Allow sharing for this connected editor session. You can revoke future sharing in
              Conversation settings. Data already sent cannot be retracted.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button tone="secondary" onClick={agent.closeConsent}>
                Not now
              </Button>
              <Button disabled={disabled} onClick={() => void agent.allowAndSend()}>
                Allow and send
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
      {settings ? (
        <Dialog title="Conversation settings" onClose={() => setSettings(false)}>
          <div className="max-h-[65dvh] space-y-5 overflow-y-auto p-4 text-sm text-text-muted">
            <section className="space-y-2">
              <h3 className="font-medium text-text">Sharing</h3>
              <p>{agent.capabilities.data?.disclosure}</p>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={agent.disclosed}
                  onChange={(event) => agent.setDisclosed(event.target.checked)}
                />
                Share chat, selected files and relevant career data with configured services.
              </label>
              <p className="text-xs">
                Revoking sharing blocks future sends. It cannot retract data already sent.
              </p>
              {agent.busy ? (
                <div className="space-y-2">
                  <p>The current task continues until stopped separately.</p>
                  <Button
                    onClick={() =>
                      void agent.stop().catch((error: unknown) => agent.setError(error))
                    }
                  >
                    Stop task
                  </Button>
                </div>
              ) : null}
              <p className="text-xs">
                When Web search is on, the assistant can choose queries and read pages. Queries and
                page URLs are shared with the configured web services.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="font-medium text-text">Changes</h3>
              <p>
                {agent.grant
                  ? "Task edits are enabled for the current resource."
                  : "Review suggested changes before they are saved."}{" "}
                Archive, restore and merges always need review.
              </p>
              {agent.canGenerate &&
              /^\/(records|points|resumes)\/[a-f0-9-]{36}/.test(agent.contextPath) ? (
                <>
                  <p className="text-xs">Current resource only. Up to 5 edits for 10 minutes.</p>
                  <Button
                    size="sm"
                    icon={agent.grant ? "private" : "confirm"}
                    onClick={() => void agent.authorize()}
                  >
                    {agent.grant ? "Revoke task edits" : "Allow task edits"}
                  </Button>
                </>
              ) : null}
            </section>
            <details className="border-t border-line-subtle pt-3">
              <summary className="cursor-pointer font-medium text-text">File limits</summary>
              <p className="mt-2 text-xs">
                Generation formats: {generationFormats(mediaTypes)}. Text aliases such as Markdown
                are UTF-8 text. Up to {agent.capabilities.data?.maxAttachments ?? 5} files;{" "}
                {fileSize(agent.capabilities.data?.maxFileBytes ?? 16777216)} per file,{" "}
                {fileSize(agent.capabilities.data?.maxTextFileBytes ?? 1048576)} for text;{" "}
                {fileSize(agent.capabilities.data?.maxTurnBytes ?? 33554432)} per turn.
              </p>
            </details>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
