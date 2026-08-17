export const ARCHIVED_FILTERS = ["exclude", "include", "only"] as const;

export type ArchivedFilter = (typeof ARCHIVED_FILTERS)[number];

export const ARCHIVED_LABELS: Record<ArchivedFilter, string> = {
  exclude: "Live",
  include: "All",
  only: "Archived",
};

export function matchesArchived(
  row: { archivedAt: string | null },
  filter: ArchivedFilter,
): boolean {
  if (filter === "include") return true;
  return filter === "only" ? row.archivedAt !== null : row.archivedAt === null;
}
