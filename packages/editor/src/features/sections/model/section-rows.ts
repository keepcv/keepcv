import { bySortKey, live } from "@keepcv/core";
import type { CustomSection, Store } from "@keepcv/schema";

export interface SectionRow {
  section: CustomSection;
  records: number;
  isArchived: boolean;
}

// In their own order, not alphabetical: a custom section carries a sort key
// because the headings are a list the user arranges, unlike a tag vocabulary.
export function sectionRows(store: Store, archived: boolean): SectionRow[] {
  return [...store.customSections]
    .sort(bySortKey)
    .map((section) => ({
      section,
      records: live(store.records).filter(
        (row) => row.kind === "custom_entry" && row.customSectionId === section.id,
      ).length,
      isArchived: section.archivedAt !== null,
    }))
    .filter((row) => row.isArchived === archived);
}

export function headingError(
  store: Store,
  heading: string,
  editing?: CustomSection,
): string | undefined {
  const wanted = heading.trim().toLowerCase();
  if (wanted === "") return "A section needs a heading.";
  const clash = live(store.customSections).find(
    (row) => row.heading.trim().toLowerCase() === wanted && row.id !== editing?.id,
  );
  return clash === undefined ? undefined : `${clash.heading} already prints under that heading.`;
}
