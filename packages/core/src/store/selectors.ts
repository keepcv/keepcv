import type {
  CareerRecord,
  CareerRecordKind,
  Organisation,
  Point,
  Store,
  Tag,
  Uuid,
} from "@keepcv/schema";
import { CAREER_RECORD_KINDS } from "@keepcv/schema";

// The whole store is kilobytes and the client holds all of it, so the screens
// read it through these rather than through requests of their own
// (application-structure.md #4). Pure, and therefore equally callable from the
// browser, the CLI and a server-side renderer.

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

// A point belongs to a record two ways: `recordId` decides where it prints, and
// a secondary link says it also relates to one. A screen counting either without
// the other reports a number the user cannot reconcile with what they see.
export function pointsOfRecord(store: Store, recordId: Uuid): Point[] {
  const alsoRelated = new Set(
    store.pointRecordLinks.filter((link) => link.recordId === recordId).map((link) => link.pointId),
  );
  return store.points.filter((point) => point.recordId === recordId || alsoRelated.has(point.id));
}

// Points nobody has placed. The inbox: capturing a point before deciding where
// it belongs is the whole reason `recordId` is nullable.
export function unplacedPoints(store: Store): Point[] {
  return live(store.points).filter((point) => point.recordId === null);
}

// The four-level chain the data model resolves in one join - point to set, set
// to its canonical phrasing, phrasing to the revision it points at, revision to
// the words. Any link missing means the point has nothing to say yet, which is a
// state the editor can reach and the screen has to render.
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

// Archived tags come back too, like archived rows anywhere else: `live` is the
// caller's filter to apply, and a tag that vanished from a row it is on would
// read as an unexplained change rather than as something hidden.
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

// Every tag, including the ones nothing carries: an unused tag is the one worth
// renaming or merging away, so a list that hid it would hide the work.
// The counts are of live rows, which is what clicking the tag then shows.
export function tagUsage(store: Store): TagUsage[] {
  return store.tags.map((tag) => ({
    tag,
    records: live(recordsWithTag(store, tag.id)).length,
    points: live(pointsWithTag(store, tag.id)).length,
  }));
}

export interface RecordCount {
  kind: CareerRecordKind;
  live: number;
  archived: number;
}

// Every kind, including the ones at zero: an empty count is the invitation to
// add the first one, and a kind that vanishes from the list cannot be clicked.
export function recordCounts(store: Store): RecordCount[] {
  return CAREER_RECORD_KINDS.map((kind) => {
    const ofKind = store.records.filter((entry) => entry.kind === kind);
    return { kind, live: live(ofKind).length, archived: archived(ofKind).length };
  });
}

export interface Unfinished {
  // Not current and with no end date: two different facts, which is why an
  // ongoing period is a flag rather than a null end date.
  missingEndDate: CareerRecord[];
  // A point that says a thing happened without saying what it moved. The most
  // common gap between a point that reads as a duty and one that reads as work.
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

// `asOf` is a parameter rather than `Date.now()`, so this stays pure and a test
// can ask what the screen will say in March without waiting for March.
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
      // A partial date compares correctly as a string against a full one, since
      // "2026-03" sorts before "2026-03-14" and both sort before "2026-04".
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
