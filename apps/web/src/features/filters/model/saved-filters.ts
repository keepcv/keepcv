import { bySortKey, keyForPosition, live, newUuid } from "@keepcv/core";
import type { FilterSubject, SavedFilter, SavedFilterInput, Store, Uuid } from "@keepcv/schema";
import { savedFilterInputSchema } from "@keepcv/schema";
import type { ArchivedFilter } from "../../../lib/archived.js";
import type { PointFilter } from "../../points/model/point-rows.js";
import type { RecordFilters } from "../../records/model/record-rows.js";

// What a list is narrowed by, without the name and the place in the list: those
// belong to the row, and this is what decides whether the row already exists.
export type Narrowing = Pick<
  SavedFilterInput,
  "subject" | "query" | "kind" | "tagId" | "archived" | "unfinished"
>;

export function recordNarrowing(of: RecordFilters): Narrowing {
  return {
    subject: "record",
    query: "",
    kind: of.kind ?? null,
    tagId: of.tagId ?? null,
    archived: of.archived,
    unfinished: null,
  };
}

// The point list narrows by one control holding four values, two of which are
// facts about a point and one of which is an archived scope. Stored apart, so a
// filter says what it means rather than repeating a widget's vocabulary.
export function pointNarrowing(of: { filter: PointFilter; tagId?: Uuid | undefined }): Narrowing {
  return {
    subject: "point",
    query: "",
    kind: null,
    tagId: of.tagId ?? null,
    archived: of.filter === "archived" ? "only" : "exclude",
    unfinished:
      of.filter === "unplaced" ? "unplaced" : of.filter === "unmeasured" ? "unmeasured" : null,
  };
}

export function savedFiltersOf(store: Store, subject: FilterSubject): SavedFilter[] {
  return live(store.savedFilters)
    .filter((row) => row.subject === subject)
    .sort(bySortKey);
}

export function filterInput(store: Store, name: string, of: Narrowing): SavedFilterInput {
  const scope = store.savedFilters.filter((row) => row.subject === of.subject);
  return savedFilterInputSchema.parse({
    ...of,
    id: newUuid(),
    name: name.trim(),
    sortKey: keyForPosition(scope, null, scope.length),
  });
}

// A filter naming exactly this narrowing already, so one list is not saved twice
// under two names.
export function alreadySaved(store: Store, of: Narrowing): SavedFilter | undefined {
  return savedFiltersOf(store, of.subject).find(
    (row) =>
      row.kind === of.kind &&
      row.tagId === of.tagId &&
      row.archived === of.archived &&
      row.unfinished === of.unfinished,
  );
}

export function recordSearchOf(filter: SavedFilter): Record<string, unknown> {
  return {
    ...(filter.kind === null ? {} : { kind: filter.kind }),
    ...(filter.tagId === null ? {} : { tag: filter.tagId }),
    archived: filter.archived satisfies ArchivedFilter,
  };
}

export function pointSearchOf(filter: SavedFilter): Record<string, unknown> {
  const named: PointFilter = filter.archived === "only" ? "archived" : (filter.unfinished ?? "all");
  return { filter: named, ...(filter.tagId === null ? {} : { tag: filter.tagId }) };
}
