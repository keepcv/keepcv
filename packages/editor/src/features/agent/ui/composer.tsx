import { newUuid } from "@keepcv/core";
import { Button } from "../../../components/ui/button.js";
import { readEdit } from "../../../lib/edit-recovery.js";
import { recoverFiles } from "../model/files.js";
import { useAgent } from "./context.js";

function fileSize(bytes: number) {
  if (bytes % (1024 * 1024) === 0) return `${bytes / (1024 * 1024)} MiB`;
  if (bytes % 1024 === 0) return `${bytes / 1024} KiB`;
  return `${bytes} bytes`;
}

export function Composer() {
  const agent = useAgent();
  return (
    <form
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (
          agent.files.length + event.dataTransfer.files.length <=
          (agent.capabilities.data?.maxAttachments ?? 5)
        )
          agent.changeFiles([
            ...agent.files,
            ...Array.from(event.dataTransfer.files).map((file) => ({ id: newUuid(), file })),
          ]);
        else agent.setError("Choose fewer files to fit the configured attachment limit.");
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void agent.send();
      }}
      className="max-h-[60dvh] shrink-0 space-y-3 overflow-y-auto rounded-xl border border-line bg-surface p-4"
    >
      <label htmlFor="agent-message" className="block text-sm font-medium">
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
        rows={3}
        className="w-full resize-y rounded-lg border border-line bg-canvas p-3 text-sm"
        placeholder="Find relevant Points, improve wording, or help compose a resume..."
      />
      <div
        id="agent-composer-help"
        className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted"
      >
        <span>{agent.grant ? "Task edit permission requested" : "Changes need your review"}</span>
        <span className="hidden sm:inline">Ctrl/Cmd+Enter to send; Enter for a new line.</span>
      </div>
      <label className="flex items-start gap-2 text-xs text-text-muted">
        <input
          type="checkbox"
          checked={agent.disclosed}
          onChange={(event) => agent.setDisclosed(event.target.checked)}
        />
        Allow sharing this conversation, selected files and relevant career data with the configured
        model services.
      </label>
      {agent.conversation.data?.archivedAt != null ? (
        <p className="text-xs text-text-muted">
          Restore this conversation before sending a new message.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          tone="primary"
          disabled={
            agent.busy ||
            agent.deciding !== null ||
            agent.conversation.data?.archivedAt != null ||
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
      </div>
      <details
        className="text-xs text-text-muted"
        open={agent.files.length > 0 || Boolean(agent.publicQuery) || agent.grant || undefined}
      >
        <summary className="cursor-pointer">Attachments, research and permissions</summary>
        <div className="mt-3 max-h-[35dvh] space-y-4 overflow-y-auto pr-1">
          <details
            className="rounded-lg border border-line-subtle p-3"
            open={agent.files.length > 0 || undefined}
          >
            <summary className="cursor-pointer text-sm text-text-muted">
              Attach files{agent.files.length ? ` (${String(agent.files.length)})` : ""}
            </summary>
            <fieldset aria-label="Attachments" className="mt-3 space-y-2">
              <label className="block text-xs text-text-muted">
                Attach PDF, PNG, JPEG, WebP or UTF-8 text. Up to{" "}
                {agent.capabilities.data?.maxAttachments ?? 5} files;{" "}
                {fileSize(agent.capabilities.data?.maxFileBytes ?? 16777216)} per file,{" "}
                {fileSize(agent.capabilities.data?.maxTextFileBytes ?? 1048576)} for text;{" "}
                {fileSize(agent.capabilities.data?.maxTurnBytes ?? 33554432)} per turn.
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.asc,.ascii,.md,.csv,.tsv,.json,.yaml,.yml,.log"
                  className="mt-2 block w-full text-xs"
                  onChange={(event) => {
                    const incoming = Array.from(event.target.files ?? []);
                    if (
                      agent.files.length + incoming.length >
                      (agent.capabilities.data?.maxAttachments ?? 5)
                    )
                      agent.setError("Choose fewer files to fit the configured attachment limit.");
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
                    onClick={() =>
                      agent.changeFiles(agent.files.filter((row) => row.id !== file.id))
                    }
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
          <details className="text-xs text-text-muted" open={agent.grant || undefined}>
            <summary className="cursor-pointer">Model services, permissions and recovery</summary>
            <p className="mt-3">{agent.capabilities.data?.disclosure}</p>
            <p className="mt-2">Changes require review unless you grant task access.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {agent.canGenerate &&
              /^\/(records|points|resumes)\/[a-f0-9-]{36}/.test(agent.path) ? (
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
                Ordinary edits to the authorized resource: up to five writes for ten minutes.
                Archive, restore and merges still require review.
              </p>
            ) : null}
          </details>
        </div>
      </details>
    </form>
  );
}
