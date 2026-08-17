import type {
  CareerRecord,
  CareerRecordKind,
  Draft,
  DraftTarget,
  Organisation,
  Phrasing,
  Point,
  Resume,
  ResumeEntry,
  ResumeEntryPoint,
  ResumeSection,
  Store,
  Tag,
  Uuid,
} from "@keepcv/schema";
import { CAREER_RECORD_KINDS } from "@keepcv/schema";

// Screens read the cached store through these rather than through requests of
// their own (application-structure.md #4).

interface Archivable {
  archivedAt: string | null;
}

export function live<T extends Archivable>(rows: readonly T[]): T[] {
  return rows.filter((row) => row.archivedAt === null);
}

export function archived<T extends Archivable>(rows: readonly T[]): T[] {
  return rows.filter((row) => row.archivedAt !== null);
}

export function organisationOf(store: Store, entry: CareerRecord): Organisation | undefined {
  if (entry.organisationId === null) return undefined;
  return store.organisations.find((row) => row.id === entry.organisationId);
}

// Both ways a point belongs: counting one without the other reports a number
// the user cannot reconcile with the points on the screen.
export function pointsOfRecord(store: Store, recordId: Uuid): Point[] {
  const alsoRelated = new Set(
    store.pointRecordLinks.filter((link) => link.recordId === recordId).map((link) => link.pointId),
  );
  return store.points.filter((point) => point.recordId === recordId || alsoRelated.has(point.id));
}

export function unplacedPoints(store: Store): Point[] {
  return live(store.points).filter((point) => point.recordId === null);
}

// A missing link means the point has nothing to say yet, which the editor can
// reach and the screen has to render.
export function textOfPoint(store: Store, point: Point): string {
  return textOfPhrasingSet(store, point.phrasingSetId);
}

export function textOfPhrasingSet(store: Store, phrasingSetId: Uuid | null): string {
  if (phrasingSetId === null) return "";
  const set = store.phrasingSets.find((row) => row.id === phrasingSetId);
  const phrasing = store.phrasings.find((row) => row.id === set?.canonicalPhrasingId);
  const revision = store.phrasingRevisions.find((row) => row.id === phrasing?.currentRevisionId);
  return revision?.plainText ?? "";
}

// Archived tags come back too: `live` is the caller's filter to apply.
export function tagsOfRecord(store: Store, recordId: Uuid): Tag[] {
  const assigned = new Set(
    store.recordTags.filter((entry) => entry.recordId === recordId).map((entry) => entry.tagId),
  );
  return store.tags.filter((tag) => assigned.has(tag.id));
}

export function tagsOfPoint(store: Store, pointId: Uuid): Tag[] {
  const assigned = new Set(
    store.pointTags.filter((entry) => entry.pointId === pointId).map((entry) => entry.tagId),
  );
  return store.tags.filter((tag) => assigned.has(tag.id));
}

export function recordsWithTag(store: Store, tagId: Uuid): CareerRecord[] {
  const carries = new Set(
    store.recordTags.filter((entry) => entry.tagId === tagId).map((entry) => entry.recordId),
  );
  return store.records.filter((entry) => carries.has(entry.id));
}

export function pointsWithTag(store: Store, tagId: Uuid): Point[] {
  const carries = new Set(
    store.pointTags.filter((entry) => entry.tagId === tagId).map((entry) => entry.pointId),
  );
  return store.points.filter((point) => carries.has(point.id));
}

export interface TagUsage {
  tag: Tag;
  records: number;
  points: number;
}

// Every tag, including the ones nothing carries. Counts are of live rows, which
// is what clicking the tag then shows.
export function tagUsage(store: Store): TagUsage[] {
  return store.tags.map((tag) => ({
    tag,
    records: live(recordsWithTag(store, tag.id)).length,
    points: live(pointsWithTag(store, tag.id)).length,
  }));
}

// Asked before an editor opens (application-structure.md #6).
export function draftFor(store: Store, target: DraftTarget): Draft | undefined {
  return store.drafts.find(
    (draft) =>
      draft.targetKind === target.targetKind &&
      draft.targetId === target.targetId &&
      draft.field === target.field,
  );
}

export interface RecordCount {
  kind: CareerRecordKind;
  live: number;
  archived: number;
}

// Every kind, including the ones at zero: a kind not on the list is unclickable.
export function recordCounts(store: Store): RecordCount[] {
  return CAREER_RECORD_KINDS.map((kind) => {
    const ofKind = store.records.filter((entry) => entry.kind === kind);
    return { kind, live: live(ofKind).length, archived: archived(ofKind).length };
  });
}

export interface Unfinished {
  // Not current and with no end date: two different facts.
  missingEndDate: CareerRecord[];
  pointsWithoutMetrics: Point[];
  expiringCertifications: CareerRecord[];
  unplacedPoints: Point[];
}

export interface StoreOverview {
  counts: RecordCount[];
  totals: { records: number; points: number; archived: number };
  recentlyEdited: CareerRecord[];
  unfinished: Unfinished;
}

const RECENTLY_EDITED = 8;
const EXPIRING_WITHIN_DAYS = 90;

// A parameter rather than `Date.now()`, so a test can ask about March in January.
export function overview(
  store: Store,
  options: { asOf: string; expiringWithinDays?: number },
): StoreOverview {
  const liveRecords = live(store.records);
  const livePoints = live(store.points);
  const withMetrics = new Set(live(store.metrics).map((metric) => metric.pointId));

  const horizon = new Date(options.asOf);
  horizon.setUTCDate(horizon.getUTCDate() + (options.expiringWithinDays ?? EXPIRING_WITHIN_DAYS));

  return {
    counts: recordCounts(store),
    totals: {
      records: liveRecords.length,
      points: livePoints.length,
      archived: archived(store.records).length + archived(store.points).length,
    },
    recentlyEdited: [...liveRecords]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
      .slice(0, RECENTLY_EDITED),
    unfinished: {
      missingEndDate: liveRecords.filter(
        (entry) => !entry.isCurrent && entry.startedOn !== null && entry.endedOn === null,
      ),
      pointsWithoutMetrics: livePoints.filter((point) => !withMetrics.has(point.id)),
      // Partial dates compare correctly as strings: "2026-03" < "2026-03-14" < "2026-04".
      expiringCertifications: liveRecords.filter(
        (entry) =>
          entry.kind === "certification" &&
          entry.expiresOn !== null &&
          entry.expiresOn <= horizon.toISOString().slice(0, 10),
      ),
      unplacedPoints: unplacedPoints(store),
    },
  };
}

export interface ComposedPoint {
  entryPoint: ResumeEntryPoint;
  point: Point;
  phrasing: Phrasing;
}

export interface ComposedEntry {
  entry: ResumeEntry;
  record: CareerRecord;
  points: ComposedPoint[];
}

export interface ComposedSection {
  section: ResumeSection;
  entries: ComposedEntry[];
}

export interface Composition {
  resume: Resume;
  sections: ComposedSection[];
}

function byId<T extends { id: Uuid }>(rows: readonly T[]): Map<Uuid, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function inOrder<T extends { sortKey: string; id: Uuid }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id));
}

// What a resume is made of, resolved and ordered. There is no route for it
// (api-contract.md #3).
export function composition(store: Store, resumeId: Uuid): Composition | undefined {
  const resume = store.resumes.find((row) => row.id === resumeId);
  if (resume === undefined) return undefined;

  const records = byId(store.records);
  const points = byId(store.points);
  const phrasings = byId(store.phrasings);

  const entryPointsOf = (entryId: Uuid): ComposedPoint[] =>
    inOrder(live(store.resumeEntryPoints).filter((row) => row.resumeEntryId === entryId)).flatMap(
      (entryPoint) => {
        const point = points.get(entryPoint.pointId);
        const phrasing = phrasings.get(entryPoint.phrasingId);
        return point === undefined || phrasing === undefined
          ? []
          : [{ entryPoint, point, phrasing }];
      },
    );

  const entriesOf = (sectionId: Uuid): ComposedEntry[] =>
    inOrder(live(store.resumeEntries).filter((row) => row.resumeSectionId === sectionId)).flatMap(
      (entry) => {
        const record = records.get(entry.recordId);
        return record === undefined ? [] : [{ entry, record, points: entryPointsOf(entry.id) }];
      },
    );

  return {
    resume,
    sections: inOrder(live(store.resumeSections).filter((row) => row.resumeId === resumeId)).map(
      (section) => ({ section, entries: entriesOf(section.id) }),
    ),
  };
}
