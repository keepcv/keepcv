import type { ReactNode } from "react";
import { isProblem } from "../lib/api.js";

// Skeletons on lists rather than a spinner: the shape of what is coming is
// information, and a spinner is a promise with no content in it.
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-lg bg-slate-200" />
      ))}
    </div>
  );
}

// An empty state is content, not an apology. The empty list is the moment the
// data-entry cold start is won or lost, so it invites the first entry rather
// than reporting a count of zero.
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="text-base font-medium text-slate-900">{title}</p>
      {children === undefined ? null : (
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{children}</p>
      )}
    </div>
  );
}

// Typed end to end: the API answers RFC 9457, so this renders a problem rather
// than parsing a message out of prose.
export function Failure({ error, retry }: { error: unknown; retry?: () => void }) {
  const problem = isProblem(error) ? error.problem : undefined;
  const title = problem?.title ?? "Something went wrong";
  const detail =
    problem?.detail ?? (error instanceof Error ? error.message : "No detail came back.");

  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-6 py-5">
      <p className="text-base font-medium text-red-900">{title}</p>
      <p className="mt-1 text-sm text-red-800">{detail}</p>
      {problem?.status === 401 ? (
        <p className="mt-3 text-sm text-red-800">
          The launcher prints a URL carrying this session's token. Open that one - a token is minted
          per launch and the previous one stops working.
        </p>
      ) : null}
      {retry === undefined ? null : (
        <button
          type="button"
          onClick={retry}
          className="mt-4 rounded bg-red-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          Try again
        </button>
      )}
    </div>
  );
}
