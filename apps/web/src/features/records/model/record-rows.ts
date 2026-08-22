import { live, organisationOf, pointsOfRecord, recordsWithTag } from "@keepcv/core";
import type { CareerRecord, CareerRecordKind, Store, Uuid } from "@keepcv/schema";
import { CAREER_RECORD_KINDS } from "@keepcv/schema";
import { type ArchivedFilter, matchesArchived } from "../../../lib/archived.js";
import { formatPartialDate } from "../../../lib/partial-date.js";

// Formatting lives here rather than on the DTO (application-structure.md #1).
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
  kind: CareerRecordKind;
  rows: RecordRow[];
}

// In the order the kinds are declared, which is reading order: storage order
// puts Awards above Experience, and nobody reads a career that way.
export function groupedRecordRows(store: Store, filters: RecordFilters): RecordGroup[] {
  const rows = recordRows(store, filters);
  return CAREER_RECORD_KINDS.map((kind) => ({
    kind,
    rows: rows.filter((row) => row.kind === kind),
  })).filter((group) => group.rows.length > 0);
}
