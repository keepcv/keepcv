import type { Problem } from "@keepcv/schema";
import { createContext, useContext } from "react";
import type { DataPagePresentation } from "../features/data/model/presentation.js";

export type HostAction = { id: string; label: string } & (
  | { href: string; onSelect?: never }
  | { onSelect: () => void; href?: never }
);
export interface EditorFailure {
  message: string;
  problem?: Problem;
  retryAfter?: string;
}
export interface EditorPresentation {
  sizing?: "viewport" | "container" | undefined;
  hostActions?: readonly HostAction[] | undefined;
  recoveryActions?: ((failure: EditorFailure) => readonly HostAction[]) | undefined;
  signOut?: (() => void) | undefined;
  dataPage?: DataPagePresentation | undefined;
}
export const HostContext = createContext<EditorPresentation>({});
export const useHost = () => useContext(HostContext);

export function actionHref(value: string): string | undefined {
  try {
    const url = new URL(value, window.location.origin);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function HostActions({
  actions,
  collapsed = false,
  onSelect,
}: {
  actions: readonly HostAction[];
  collapsed?: boolean;
  onSelect?: (() => void) | undefined;
}) {
  return (
    <>
      {actions
        .filter((action, index) => actions.findIndex((other) => other.id === action.id) === index)
        .map((action) => {
          const className =
            "block w-full rounded-lg px-3 py-2 text-left text-sm text-text-muted hover:bg-surface-hover focus-visible:outline";
          const label = collapsed ? (
            <span aria-hidden>{action.label.slice(0, 1)}</span>
          ) : (
            action.label
          );
          if (action.href !== undefined) {
            const href = actionHref(action.href);
            return href === undefined ? null : (
              <a
                key={action.id}
                href={href}
                className={className}
                aria-label={action.label}
                title={action.label}
                onClick={onSelect}
              >
                {label}
              </a>
            );
          }
          return (
            <button
              key={action.id}
              type="button"
              className={className}
              aria-label={action.label}
              title={action.label}
              onClick={() => {
                onSelect?.();
                action.onSelect();
              }}
            >
              {label}
            </button>
          );
        })}
    </>
  );
}
