import type { ReactNode } from "react";
import { Icon } from "../components/icon/icon.js";
import { Spot, type SpotName } from "../components/icon/spot.js";
import { Button } from "../components/ui/button.js";
import { isProblem } from "../lib/api.js";

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-xl bg-surface-sunken" />
      ))}
    </div>
  );
}

export function Empty({
  title,
  spot = "emptyStore",
  action,
  children,
}: {
  title: string;
  spot?: SpotName;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <Spot name={spot} className="mb-4" />
      <p className="text-base font-medium text-text">{title}</p>
      {children === undefined ? null : (
        <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">{children}</p>
      )}
      {action === undefined ? null : <div className="mt-5">{action}</div>}
    </div>
  );
}

// The API answers RFC 9457, so this renders a problem rather than parsing
// prose.
export function Failure({ error, retry }: { error: unknown; retry?: () => void }) {
  const problem = isProblem(error) ? error.problem : undefined;
  const title = problem?.title ?? "Something went wrong";
  const detail =
    problem?.detail ?? (error instanceof Error ? error.message : "No detail came back.");

  return (
    <div
      role="alert"
      className="rounded-xl border border-critical/40 bg-critical-soft px-5 py-4 text-critical-text"
    >
      <p className="flex items-center gap-2 text-base font-medium">
        <Icon name="error" size="lg" />
        {title}
      </p>
      <p className="mt-1 text-sm">{detail}</p>
      {problem?.status === 401 ? (
        <p className="mt-3 text-sm">
          The launcher prints a URL carrying this session's token. Open that one - a token is minted
          per launch and the previous one stops working.
        </p>
      ) : null}
      {retry === undefined ? null : (
        <Button className="mt-4" icon="refresh" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
