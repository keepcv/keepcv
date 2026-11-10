import { useState } from "react";
import { Icon } from "../../../components/icon/icon.js";
import { cn } from "../../../lib/cn.js";
import { useAgent } from "./context.js";

export function ConversationHistory({ onChoose }: { onChoose?: (() => void) | undefined }) {
  const agent = useAgent();
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const conversations = (agent.conversations.data ?? [])
    .filter((item) => (archived ? item.archivedAt !== null : item.archivedAt === null))
    .filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : 0));

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-canvas px-3">
          <Icon name="search" size="sm" />
          <input
            aria-label="Search conversations"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations..."
            className="h-10 min-w-0 flex-1 bg-transparent text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <input
            type="checkbox"
            checked={archived}
            onChange={(event) => setArchived(event.target.checked)}
          />
          Archived
        </label>
      </div>
      <ul className="min-h-0 space-y-1 overflow-y-auto" aria-label="Saved conversations">
        {conversations.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={agent.busy || agent.deciding !== null}
              aria-current={agent.id === item.id ? "true" : undefined}
              title={item.title}
              onClick={() => {
                agent.setId(item.id);
                onChoose?.();
              }}
              className={cn(
                "flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-50",
                agent.id === item.id && "bg-surface-hover text-text",
              )}
            >
              <Icon name="conversation" size="sm" className="shrink-0 text-text-subtle" />
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {conversations.length === 0 ? (
        <p className="px-3 text-xs text-text-subtle">
          {agent.conversations.isPending
            ? "Loading conversations..."
            : query
              ? "No matching conversations."
              : archived
                ? "No archived conversations."
                : "No saved conversations yet."}
        </p>
      ) : null}
    </div>
  );
}
