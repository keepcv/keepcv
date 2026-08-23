import type { Store, Uuid } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";

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
    <p className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-sunken px-3 py-2 text-sm text-text-muted">
      Filed under{" "}
      <span className="font-medium">{tag?.label ?? "a tag the store no longer has"}</span>
      <Link
        to={to}
        search={search}
        className="text-xs text-text-subtle underline underline-offset-2 hover:text-text"
      >
        Show everything
      </Link>
    </p>
  );
}
