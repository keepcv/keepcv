import type { AgentToolCall } from "@keepcv/schema";

export function ToolActivity({ calls }: { calls: readonly AgentToolCall[] }) {
  if (calls.length === 0) return null;
  return (
    <ul
      aria-label="Tools called"
      className="space-y-1.5 border-l border-line pl-3 text-xs text-text-muted"
    >
      {calls.map((call, index) => (
        <li
          key={String(index)}
          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
        >
          <span>
            {call.summary
              .replace("Check available changes for ", "Check fields: ")
              .replace("Choose a position in the ordered list", "Set item order")
              .replace("Allocate identities for new data", "Allocate IDs")
              .replace("Propose 1 changes", "Propose 1 change")}
          </span>
          <code className="text-[0.6875rem] text-text-subtle">{call.name}</code>
        </li>
      ))}
    </ul>
  );
}
