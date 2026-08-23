import { tagForLabel, tagUsage } from "@keepcv/core";
import type { Store, Tag } from "@keepcv/schema";

export const TAG_FILTERS = ["all", "unused", "archived"] as const;

export type TagFilter = (typeof TAG_FILTERS)[number];

export const TAG_FILTER_LABELS: Record<TagFilter, string> = {
  all: "All",
  unused: "Unused",
  archived: "Archived",
};

export const TAG_BLURBS: Record<TagFilter, string> = {
  all: "The words you file work under. Both records and points carry them, and a resume is matched against them.",
  unused: "Nothing carries these. They are the ones worth merging away or putting aside.",
  archived:
    "Put aside, never deleted. A merged tag ends up here with everything it carried moved on.",
};

export interface TagRow {
  tag: Tag;
  records: number;
  points: number;
  isArchived: boolean;
}

// Alphabetical: a tag has no sort key.
export function tagRows(store: Store, filter: TagFilter): TagRow[] {
  return tagUsage(store)
    .map((usage) => ({ ...usage, isArchived: usage.tag.archivedAt !== null }))
    .filter((row) => (filter === "archived" ? row.isArchived : !row.isArchived))
    .filter((row) => filter !== "unused" || row.records + row.points === 0)
    .sort((a, b) => a.tag.label.localeCompare(b.tag.label));
}

// `tag_slug_unique` refuses the second of two labels that slug alike, so the
// form names the tag it would collide with rather than showing the constraint.
export function labelError(store: Store, label: string, editing?: Tag): string | undefined {
  if (label.trim() === "") return "A tag needs a name.";
  const clash = tagForLabel(store, label);
  if (clash === undefined || clash.id === editing?.id) return undefined;
  return `${clash.label} already covers that.`;
}
