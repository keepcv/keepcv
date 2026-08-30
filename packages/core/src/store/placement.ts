import type {
  CareerRecord,
  Point,
  ResumeEntry,
  ResumeEntryPoint,
  ResumeSection,
  SectionKind,
  SortKey,
  Store,
  Uuid,
} from "@keepcv/schema";
import { SECTION_KINDS } from "@keepcv/schema";
import { bySortKey, generateKeyBetween } from "../ordering/sort-key.js";
import { live, pointsOfRecord, sectionHeading } from "./selectors.js";

// What the composer can still add, and the key a row takes when it lands. Every
// uniqueness and sort-key index on the composition covers archived rows, so an
// add is a create or a restore and never a second row.

interface Placed {
  id: Uuid;
  sortKey: SortKey;
  archivedAt: string | null;
}

function inOrder<T extends { sortKey: string; id: Uuid }>(rows: readonly T[]): T[] {
  return [...rows].sort(bySortKey);
}

export interface PlaceableSection {
  kind: SectionKind;
  customSectionId: Uuid | null;
  heading: string;
}

function sectionSlot(section: Pick<ResumeSection, "kind" | "customSectionId">): string {
  return `${section.kind}:${section.customSectionId ?? ""}`;
}

// One per kind, and one per custom section, which is what
// `resume_section_kind_unique` counts.
export function placeableSections(store: Store, resumeId: Uuid): PlaceableSection[] {
  const held = new Set(
    live(store.resumeSections)
      .filter((row) => row.resumeId === resumeId)
      .map(sectionSlot),
  );

  return SECTION_KINDS.flatMap<Pick<PlaceableSection, "kind" | "customSectionId">>((kind) =>
    kind === "custom"
      ? live(store.customSections).map((row) => ({ kind, customSectionId: row.id }))
      : [{ kind, customSectionId: null }],
  )
    .filter((slot) => !held.has(sectionSlot(slot)))
    .map((slot) => ({ ...slot, heading: sectionHeading(store, { ...slot, heading: null }) }));
}

export function sectionFor(
  store: Store,
  resumeId: Uuid,
  slot: Pick<ResumeSection, "kind" | "customSectionId">,
): ResumeSection | undefined {
  return store.resumeSections.find(
    (row) => row.resumeId === resumeId && sectionSlot(row) === sectionSlot(slot),
  );
}

function belongsIn(record: CareerRecord, section: ResumeSection): boolean {
  if (record.kind === "custom_entry") {
    return section.kind === "custom" && record.customSectionId === section.customSectionId;
  }
  return record.kind === section.kind;
}

// Archived records are not offered: placing one would print nothing.
export function placeableRecords(store: Store, sectionId: Uuid): CareerRecord[] {
  const section = store.resumeSections.find((row) => row.id === sectionId);
  if (section === undefined) return [];

  const held = new Set(
    live(store.resumeEntries)
      .filter((row) => row.resumeSectionId === sectionId)
      .map((row) => row.recordId),
  );
  return inOrder(live(store.records).filter((row) => belongsIn(row, section) && !held.has(row.id)));
}

export function entryFor(store: Store, sectionId: Uuid, recordId: Uuid): ResumeEntry | undefined {
  return store.resumeEntries.find(
    (row) => row.resumeSectionId === sectionId && row.recordId === recordId,
  );
}

// I13 makes the resume the scope, not the entry: a point prints once whichever
// entry holds it. No patch moves one between entries, so a point put away under
// another entry is not offered here - restoring it would put it back there.
export function placeablePoints(store: Store, resumeId: Uuid, entryId: Uuid): Point[] {
  const entry = store.resumeEntries.find((row) => row.id === entryId);
  if (entry === undefined) return [];

  const taken = new Set(
    store.resumeEntryPoints
      .filter(
        (row) =>
          row.resumeId === resumeId && (row.archivedAt === null || row.resumeEntryId !== entryId),
      )
      .map((row) => row.pointId),
  );
  return inOrder(live(pointsOfRecord(store, entry.recordId)).filter((row) => !taken.has(row.id)));
}

export function entryPointFor(
  store: Store,
  resumeId: Uuid,
  pointId: Uuid,
): ResumeEntryPoint | undefined {
  return store.resumeEntryPoints.find(
    (row) => row.resumeId === resumeId && row.pointId === pointId,
  );
}

// `rows` is every row of the scope the sort-key index covers, archived
// included, and `toIndex` a position among the live ones. `undefined` means
// nothing to write.
export function keyForPosition(rows: readonly Placed[], id: null, toIndex: number): SortKey;
export function keyForPosition(
  rows: readonly Placed[],
  id: Uuid,
  toIndex: number,
): SortKey | undefined;
export function keyForPosition(
  rows: readonly Placed[],
  id: Uuid | null,
  toIndex: number,
): SortKey | undefined {
  const ordered = inOrder(rows);
  const visible = ordered.filter((row) => row.archivedAt === null);
  const others = visible.filter((row) => row.id !== id);
  const at = Math.min(Math.max(toIndex, 0), others.length);
  if (id !== null && visible.findIndex((row) => row.id === id) === at) return undefined;

  const lower = others[at - 1]?.sortKey ?? null;
  const upper = others[at]?.sortKey ?? null;
  // An archived row in the gap still holds its key, and the midpoint of the two
  // live neighbours is exactly the key it was given when it was placed there.
  const between = ordered.filter(
    (row) =>
      row.id !== id &&
      (lower === null || row.sortKey > lower) &&
      (upper === null || row.sortKey < upper),
  );
  return generateKeyBetween(between.at(-1)?.sortKey ?? lower, upper);
}
