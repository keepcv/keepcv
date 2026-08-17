import { live, organisationOf, pointsOfRecord } from "@keepcv/core";
import type { CareerRecord, CareerRecordKind, PartialDate, Store, Uuid } from "@keepcv/schema";
import { CAREER_RECORD_KINDS } from "@keepcv/schema";
import { type ArchivedFilter, matchesArchived } from "../../../lib/archived.js";

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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A real precision, not a full date with the tail unknown: rendering "2019" as
// "1 January 2019" invents a claim the user never made.
export function formatPartialDate(value: PartialDate): string {
  const [year, month, day] = value.split("-");
  if (year === undefined) return value;
  if (month === undefined) return year;
  const name = MONTHS[Number(month) - 1] ?? month;
  return day === undefined ? `${name} ${year}` : `${String(Number(day))} ${name} ${year}`;
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
  archived: ArchivedFilter;
}

// Narrows without sorting: the store already returns a total order, and a list
// that reshuffled on every filter change would be its own bug.
export function recordRows(store: Store, filters: RecordFilters): RecordRow[] {
  return store.records
    .filter((entry) => filters.kind === undefined || entry.kind === filters.kind)
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
