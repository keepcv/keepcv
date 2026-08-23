import { live, organisationOf, pointsOfRecord, recordsWithTag } from "@keepcv/core";
import type { CareerRecord, CareerRecordKind, Store, Uuid } from "@keepcv/schema";
import { CAREER_RECORD_KINDS } from "@keepcv/schema";
import { type ArchivedFilter, matchesArchived } from "../../../lib/archived.js";
import { formatPartialDate } from "../../../lib/partial-date.js";

export interface RecordRow {
  id: Uuid;
  kind: CareerRecordKind;
  title: string;
  subtitle: string | null;
  organisation: string | null;
  period: string | null;
  pointCount: number;
  isArchived: boolean;
}

// An ongoing period reads "Present"; an unfinished one is left visibly open.
export function formatPeriod(entry: CareerRecord): string | null {
  const started = entry.startedOn === null ? null : formatPartialDate(entry.startedOn);
  const ended = entry.isCurrent
    ? "Present"
    : entry.endedOn === null
      ? null
      : formatPartialDate(entry.endedOn);

  if (started === null && ended === null) return null;
  if (started === null) return `until ${ended ?? ""}`;
  return ended === null ? `${started} -` : `${started} - ${ended}`;
}

// One record, not a heading over several: a badge on a single row reading
// "Certifications" is the plural table used in a place it does not fit.
export const KIND_NAMES: Record<CareerRecordKind, string> = {
  experience: "Experience",
  education: "Education",
  project: "Project",
  skill: "Skill",
  certification: "Certification",
  publication: "Publication",
  award: "Award",
  language: "Language",
  volunteering: "Volunteering",
  speaking: "Speaking",
  custom_entry: "Custom entry",
};

export const KIND_LABELS: Record<CareerRecordKind, string> = {
  experience: "Experience",
  education: "Education",
  project: "Projects",
  skill: "Skills",
  certification: "Certifications",
  publication: "Publications",
  award: "Awards",
  language: "Languages",
  volunteering: "Volunteering",
  speaking: "Speaking",
  custom_entry: "Custom entries",
};

export function toRecordRow(store: Store, entry: CareerRecord): RecordRow {
  return {
    id: entry.id,
    kind: entry.kind,
    // A record can be saved half-entered, so this is a state, not an error.
    title: entry.title ?? "Untitled",
    subtitle: entry.subtitle,
    organisation: organisationOf(store, entry)?.name ?? null,
    period: formatPeriod(entry),
    pointCount: live(pointsOfRecord(store, entry.id)).length,
    isArchived: entry.archivedAt !== null,
  };
}

export interface RecordFilters {
  kind?: CareerRecordKind | undefined;
  tagId?: Uuid | undefined;
  archived: ArchivedFilter;
}

// Narrows without sorting: the store already returns a total order, and a list
// that reshuffled on every filter change would be its own bug.
export function recordRows(store: Store, filters: RecordFilters): RecordRow[] {
  const carrying =
    filters.tagId === undefined
      ? undefined
      : new Set(recordsWithTag(store, filters.tagId).map((entry) => entry.id));

  return store.records
    .filter((entry) => filters.kind === undefined || entry.kind === filters.kind)
    .filter((entry) => carrying === undefined || carrying.has(entry.id))
    .filter((entry) => matchesArchived(entry, filters.archived))
    .map((entry) => toRecordRow(store, entry));
}

export interface RecordGroup {
  key: string;
  kind: CareerRecordKind;
  heading: string;
  // The list this group is dragged within, archived rows included: a record's
  // sort key is scoped by `(kind, custom_section_id)`.
  scope: CareerRecord[];
  rows: RecordRow[];
}

const sectionIdOf = (entry: CareerRecord | undefined): Uuid | null =>
  entry?.kind === "custom_entry" ? entry.customSectionId : null;

function scopedRecords(
  store: Store,
  kind: CareerRecordKind,
  sectionId: Uuid | null,
): CareerRecord[] {
  return store.records.filter((entry) => entry.kind === kind && sectionIdOf(entry) === sectionId);
}

// In the order the kinds are declared, which is reading order: storage order
// puts Awards above Experience, and nobody reads a career that way.
export function groupedRecordRows(store: Store, filters: RecordFilters): RecordGroup[] {
  const rows = recordRows(store, filters);
  const held = new Map(store.records.map((entry) => [entry.id, entry]));

  return CAREER_RECORD_KINDS.flatMap((kind): RecordGroup[] => {
    const of = rows.filter((row) => row.kind === kind);
    if (of.length === 0) return [];

    if (kind !== "custom_entry") {
      return [
        {
          key: kind,
          kind,
          heading: KIND_LABELS[kind],
          scope: scopedRecords(store, kind, null),
          rows: of,
        },
      ];
    }

    // One group per heading: a custom entry is scoped by the section it prints
    // under, so all of them in one list would be a list dragged across two
    // scopes and `record_sort_key_unique` would refuse the second one.
    const sections = [...new Set(of.map((row) => sectionIdOf(held.get(row.id))))];
    return sections.map((sectionId) => ({
      key: `${kind}:${sectionId ?? ""}`,
      kind,
      heading:
        store.customSections.find((row) => row.id === sectionId)?.heading ?? KIND_LABELS[kind],
      scope: scopedRecords(store, kind, sectionId),
      rows: of.filter((row) => sectionIdOf(held.get(row.id)) === sectionId),
    }));
  });
}
