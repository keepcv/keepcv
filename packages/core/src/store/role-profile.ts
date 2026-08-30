import type { CareerRecord, Point, ResumeSection, SortKey, Store, Tag, Uuid } from "@keepcv/schema";
import { above, type CompositionPlan, change, emptyPlan, sparse } from "../document/plan.js";
import { newUuid } from "../identity/uuid.js";
import { bySortKey } from "../ordering/sort-key.js";
import { canonicalPhrasingOf, live, pointsOfRecord } from "./selectors.js";

export interface ProfileMatch {
  tags: Tag[];
  entries: { record: CareerRecord; points: Point[] }[];
  points: number;
}

function inOrder<T extends { sortKey: string; id: Uuid }>(rows: readonly T[]): T[] {
  return [...rows].sort(bySortKey);
}

function slotOf(record: CareerRecord): Pick<ResumeSection, "kind" | "customSectionId"> {
  return record.kind === "custom_entry"
    ? { kind: "custom", customSectionId: record.customSectionId }
    : { kind: record.kind, customSectionId: null };
}

// A record carrying one of the words comes whole, points included; one that
// does not brings only the points that carry one.
export function roleProfileMatch(store: Store, roleProfileId: Uuid): ProfileMatch | undefined {
  const profile = store.roleProfiles.find((row) => row.id === roleProfileId);
  if (profile === undefined) return undefined;

  const wanted = new Set(
    store.roleProfileTags
      .filter((row) => row.roleProfileId === roleProfileId)
      .map((row) => row.tagId),
  );
  const tags = live(store.tags).filter((tag) => wanted.has(tag.id));
  const carriers = new Set(
    store.pointTags.filter((row) => wanted.has(row.tagId)).map((row) => row.pointId),
  );
  const taggedRecords = new Set(
    store.recordTags.filter((row) => wanted.has(row.tagId)).map((row) => row.recordId),
  );

  const entries = inOrder(live(store.records)).flatMap((record) => {
    const all = inOrder(live(pointsOfRecord(store, record.id)));
    const whole = taggedRecords.has(record.id);
    const points = whole ? all : all.filter((point) => carriers.has(point.id));
    return whole || points.length > 0 ? [{ record, points }] : [];
  });

  return {
    tags,
    entries,
    points: entries.reduce((total, entry) => total + entry.points.length, 0),
  };
}

function sectionSlot(section: Pick<ResumeSection, "kind" | "customSectionId">): string {
  return `${section.kind}:${section.customSectionId ?? ""}`;
}

// Additive and idempotent: it places what the words select and takes nothing
// off, so a profile applied to a curated resume cannot undo the curation, and
// applying one twice writes nothing the second time.
export function roleProfilePlan(
  store: Store,
  resumeId: Uuid,
  roleProfileId: Uuid,
): CompositionPlan | undefined {
  const resume = store.resumes.find((row) => row.id === resumeId);
  const match = roleProfileMatch(store, roleProfileId);
  if (resume === undefined || match === undefined) return undefined;

  const plan = emptyPlan(resumeId);
  const sections = store.resumeSections.filter((row) => row.resumeId === resumeId);
  const entries = store.resumeEntries.filter((row) => row.resumeId === resumeId);
  const entryPoints = store.resumeEntryPoints.filter((row) => row.resumeId === resumeId);

  const nextSectionKey = above(sections.map((row) => row.sortKey));
  const entryKeyIn = new Map<Uuid, () => SortKey>();
  const nextEntryKey = (sectionId: Uuid): SortKey => {
    const next =
      entryKeyIn.get(sectionId) ??
      above(entries.filter((row) => row.resumeSectionId === sectionId).map((row) => row.sortKey));
    entryKeyIn.set(sectionId, next);
    return next();
  };
  const nextPointKey = above(entryPoints.map((row) => row.sortKey));

  const sectionIds = new Map<string, Uuid>();
  const entryIds = new Map<Uuid, Uuid>();

  const sectionFor = (record: CareerRecord): Uuid => {
    const slot = slotOf(record);
    const key = sectionSlot(slot);
    const known = sectionIds.get(key);
    if (known !== undefined) return known;

    const found = sections.find((row) => sectionSlot(row) === key);
    if (found === undefined) {
      const id = newUuid();
      plan.addSections.push({
        id,
        resumeId,
        ...slot,
        heading: null,
        layout: null,
        sortKey: nextSectionKey(),
        isVisible: true,
      });
      sectionIds.set(key, id);
      return id;
    }

    plan.sections.push(...change(found, sparse({ isVisible: true }, found)));
    sectionIds.set(key, found.id);
    return found.id;
  };

  const entryFor = (record: CareerRecord): Uuid => {
    const known = entryIds.get(record.id);
    if (known !== undefined) return known;

    const sectionId = sectionFor(record);
    const found = entries.find(
      (row) => row.resumeSectionId === sectionId && row.recordId === record.id,
    );
    if (found === undefined) {
      const id = newUuid();
      plan.addEntries.push({
        id,
        resumeId,
        resumeSectionId: sectionId,
        recordId: record.id,
        sortKey: nextEntryKey(sectionId),
        isVisible: true,
      });
      entryIds.set(record.id, id);
      return id;
    }

    plan.entries.push(...change(found, sparse({ isVisible: true }, found)));
    entryIds.set(record.id, found.id);
    return found.id;
  };

  for (const { record, points } of match.entries) {
    const entryId = entryFor(record);
    for (const point of points) {
      // I13 makes the resume the scope, so a point already placed under another
      // entry is turned back on where it is rather than moved here.
      const found = entryPoints.find((row) => row.pointId === point.id);
      if (found !== undefined) {
        plan.entryPoints.push(...change(found, sparse({ isVisible: true }, found)));
        continue;
      }

      const phrasing = canonicalPhrasingOf(store, point.phrasingSetId);
      if (phrasing === undefined) continue;
      plan.addEntryPoints.push({
        id: newUuid(),
        resumeId,
        resumeEntryId: entryId,
        pointId: point.id,
        phrasingId: phrasing.id,
        sortKey: nextPointKey(),
        isVisible: true,
      });
    }
  }

  return plan;
}

// What the words reach that the resume does not already print, which is what a
// screen offers before it writes anything.
export function roleProfileAdds(plan: CompositionPlan): { entries: number; points: number } {
  return {
    entries: plan.addEntries.length + plan.entries.length,
    points: plan.addEntryPoints.length + plan.entryPoints.length,
  };
}
