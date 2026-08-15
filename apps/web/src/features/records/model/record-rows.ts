import { live, organisationOf, pointsOfRecord, textOfPoint } from "@keepcv/core";
import type { CareerRecord, CareerRecordKind, PartialDate, Store, Uuid } from "@keepcv/schema";

// The view model: formatted for one screen and disposable. Formatting lives here
// rather than on the DTO, which is a contract and not a UI changelog
// (application-structure.md #1).
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

// A partial date is a real precision, not a full date with the tail unknown:
// "2019" means the year is all the user chose to record, and rendering it as
// "1 January 2019" would invent a claim they never made.
export function formatPartialDate(value: PartialDate): string {
  const [year, month, day] = value.split("-");
  if (year === undefined) return value;
  if (month === undefined) return year;
  const name = MONTHS[Number(month) - 1] ?? month;
  return day === undefined ? `${name} ${year}` : `${String(Number(day))} ${name} ${year}`;
}

// "Still there" and "I have not said yet" are different, so an ongoing period
// reads as "Present" and an unfinished one is left visibly open.
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
    // A record can be saved half-entered, so a missing title is a state the
    // screen renders rather than a state the store prevents.
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
  archived: "exclude" | "include" | "only";
}

// Already ordered by the store, which returns a total order, so this narrows
// without sorting: a list that reshuffled under the cursor on every filter
// change would be its own bug.
export function recordRows(store: Store, filters: RecordFilters): RecordRow[] {
  return store.records
    .filter((entry) => filters.kind === undefined || entry.kind === filters.kind)
    .filter((entry) =>
      filters.archived === "include"
        ? true
        : filters.archived === "only"
          ? entry.archivedAt !== null
          : entry.archivedAt === null,
    )
    .map((entry) => toRecordRow(store, entry));
}

export function pointTextsOf(store: Store, recordId: Uuid): string[] {
  return live(pointsOfRecord(store, recordId)).map((point) => textOfPoint(store, point));
}
