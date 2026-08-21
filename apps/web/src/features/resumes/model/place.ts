import {
  bySortKey,
  entryFor,
  entryPointFor,
  keyForPosition,
  live,
  newUuid,
  type PlaceableSection,
  sectionFor,
} from "@keepcv/core";
import type { ResumeEntry, ResumeSection, Store, Uuid } from "@keepcv/schema";
import {
  resumeEntryInputSchema,
  resumeEntryPointInputSchema,
  resumeSectionInputSchema,
} from "@keepcv/schema";
import type {
  AddComposition,
  PatchComposition,
  Placed,
  SetComposedArchived,
} from "../api/use-composition.js";

// Placing is a create or a put-back, never a second row: every uniqueness index
// on the composition covers archived rows too (data-model.md #9.1).
export type Placement = { add: AddComposition } | { putBack: SetComposedArchived };

function sectionsOf(store: Store, resumeId: Uuid) {
  return store.resumeSections.filter((row) => row.resumeId === resumeId);
}

function entriesOf(store: Store, sectionId: Uuid) {
  return store.resumeEntries.filter((row) => row.resumeSectionId === sectionId);
}

function pointsOf(store: Store, entryId: Uuid) {
  return store.resumeEntryPoints.filter((row) => row.resumeEntryId === entryId);
}

export function placeSection(store: Store, resumeId: Uuid, slot: PlaceableSection): Placement {
  const existing = sectionFor(store, resumeId, slot);
  if (existing !== undefined) {
    return { putBack: { level: "section", row: existing, archived: false } };
  }

  const siblings = sectionsOf(store, resumeId);
  return {
    add: {
      level: "section",
      input: resumeSectionInputSchema.parse({
        id: newUuid(),
        resumeId,
        kind: slot.kind,
        customSectionId: slot.customSectionId,
        heading: null,
        layout: null,
        sortKey: keyForPosition(siblings, null, siblings.length),
        isVisible: true,
      }),
    },
  };
}

export function placeRecord(store: Store, section: ResumeSection, recordId: Uuid): Placement {
  const existing = entryFor(store, section.id, recordId);
  if (existing !== undefined) {
    return { putBack: { level: "entry", row: existing, archived: false } };
  }

  const siblings = entriesOf(store, section.id);
  return {
    add: {
      level: "entry",
      input: resumeEntryInputSchema.parse({
        id: newUuid(),
        resumeId: section.resumeId,
        resumeSectionId: section.id,
        recordId,
        sortKey: keyForPosition(siblings, null, siblings.length),
        isVisible: true,
      }),
    },
  };
}

export function placePoint(
  store: Store,
  entry: ResumeEntry,
  pointId: Uuid,
  phrasingId: Uuid,
): Placement {
  const existing = entryPointFor(store, entry.resumeId, pointId);
  if (existing !== undefined) {
    return { putBack: { level: "point", row: existing, archived: false } };
  }

  const siblings = pointsOf(store, entry.id);
  return {
    add: {
      level: "point",
      input: resumeEntryPointInputSchema.parse({
        id: newUuid(),
        resumeId: entry.resumeId,
        resumeEntryId: entry.id,
        pointId,
        phrasingId,
        sortKey: keyForPosition(siblings, null, siblings.length),
        isVisible: true,
      }),
    },
  };
}

export function toggled(placed: Placed, isVisible: boolean): PatchComposition {
  switch (placed.level) {
    case "section":
      return { level: "section", row: placed.row, patch: { isVisible } };
    case "entry":
      return { level: "entry", row: placed.row, patch: { isVisible } };
    case "point":
      return { level: "point", row: placed.row, patch: { isVisible } };
  }
}

// The rows the sort-key index covers around this one, archived included.
function scopeOf(store: Store, placed: Placed) {
  switch (placed.level) {
    case "section":
      return sectionsOf(store, placed.row.resumeId);
    case "entry":
      return entriesOf(store, placed.row.resumeSectionId);
    case "point":
      return pointsOf(store, placed.row.resumeEntryId);
  }
}

function indexOf(
  scope: readonly { id: Uuid; sortKey: string; archivedAt: string | null }[],
  id: Uuid,
): number {
  return live(scope)
    .sort(bySortKey)
    .findIndex((row) => row.id === id);
}

// One row moves, because the key is fractional (data-model.md #3.4). Nothing is
// written when the row is already where the move would put it.
export function movedBy(store: Store, placed: Placed, delta: number): PatchComposition | undefined {
  const scope = scopeOf(store, placed);
  const sortKey = keyForPosition(scope, placed.row.id, indexOf(scope, placed.row.id) + delta);
  if (sortKey === undefined) return undefined;

  switch (placed.level) {
    case "section":
      return { level: "section", row: placed.row, patch: { sortKey } };
    case "entry":
      return { level: "entry", row: placed.row, patch: { sortKey } };
    case "point":
      return { level: "point", row: placed.row, patch: { sortKey } };
  }
}
