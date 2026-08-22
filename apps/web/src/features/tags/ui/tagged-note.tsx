import type { Store, Uuid } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";

// A filter that is only in the URL is one nobody can see they are inside, and
// the empty state below it reads as "you have nothing" rather than "not here".
export function TaggedNote({
  store,
  tagId,
  to,
  search,
}: {
  store: Store;
  tagId: Uuid;
  to: string;
  search: Record<string, unknown>;
}) {
  const tag = store.tags.find((row) => row.id === tagId);

  return (
    <p className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      Filed under{" "}
      <span className="font-medium">{tag?.label ?? "a tag the store no longer has"}</span>
      <Link
        to={to}
        search={search}
        className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-900"
      >
        Show everything
      </Link>
    </p>
  );
}
