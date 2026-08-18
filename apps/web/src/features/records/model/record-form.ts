import { live, newUuid } from "@keepcv/core";
import type {
  CareerRecord,
  CareerRecordInput,
  CareerRecordKind,
  CareerRecordPatch,
  OrganisationInput,
  Store,
  Uuid,
} from "@keepcv/schema";
import {
  CAREER_RECORD_KINDS,
  careerRecordInputSchema,
  careerRecordPatchSchema,
  SKILL_PROFICIENCIES,
  WORK_MODES,
} from "@keepcv/schema";
import type { ZodError } from "zod";
import { nextSortKey } from "../../../lib/sort.js";

// The columns a kind carries beyond the shared ones. `record-form.test.ts`
// checks this covers each kind's schema exactly, so a column added to the model
// cannot stay unreachable from the form.
export interface ExtraField {
  name: string;
  label: string;
  hint?: string;
  options?: readonly string[];
}

export const EXTRA_FIELDS: Record<CareerRecordKind, readonly ExtraField[]> = {
  experience: [
    { name: "employmentType", label: "Employment type", hint: "Full-time, contract, internship." },
    { name: "mode", label: "Mode", options: WORK_MODES },
  ],
  education: [
    { name: "grade", label: "Grade" },
    { name: "gradeScale", label: "Grade scale", hint: "What the grade is out of." },
    { name: "thesisTitle", label: "Thesis title" },
    { name: "honours", label: "Honours" },
  ],
  project: [],
  skill: [
    { name: "category", label: "Category" },
    { name: "proficiency", label: "Proficiency", options: SKILL_PROFICIENCIES },
  ],
  certification: [
    { name: "credentialId", label: "Credential id" },
    // Not the end date: conflating them breaks "what lapses in ninety days".
    { name: "expiresOn", label: "Expires on" },
  ],
  publication: [{ name: "doi", label: "DOI" }],
  award: [],
  language: [
    { name: "proficiency", label: "Proficiency", hint: 'Free text: "C1", "reading only".' },
  ],
  volunteering: [],
  speaking: [],
  custom_entry: [{ name: "customSectionId", label: "Section" }],
};

export interface RecordFormValues {
  kind: CareerRecordKind;
  title: string;
  subtitle: string;
  // A name rather than an id: the submit creates the organisation when the name
  // is one the store has not heard of.
  organisation: string;
  startedOn: string;
  endedOn: string;
  isCurrent: boolean;
  location: string;
  extras: Record<string, string>;
}

export type FieldErrors = Record<string, string>;

export interface RecordSubmission {
  record: CareerRecordInput;
  organisation: OrganisationInput | null;
}

export function blankValues(kind: CareerRecordKind): RecordFormValues {
  return {
    kind,
    title: "",
    subtitle: "",
    organisation: "",
    startedOn: "",
    endedOn: "",
    isCurrent: false,
    location: "",
    extras: {},
  };
}

export function valuesOf(store: Store, record: CareerRecord): RecordFormValues {
  const columns: Record<string, unknown> = { ...record };
  const organisation = store.organisations.find((row) => row.id === record.organisationId);

  return {
    kind: record.kind,
    title: record.title ?? "",
    subtitle: record.subtitle ?? "",
    organisation: organisation?.name ?? "",
    startedOn: record.startedOn ?? "",
    endedOn: record.endedOn ?? "",
    isCurrent: record.isCurrent,
    location: record.location ?? "",
    extras: Object.fromEntries(
      EXTRA_FIELDS[record.kind].map((field) => [field.name, String(columns[field.name] ?? "")]),
    ),
  };
}

// Which kinds a new record may be: a custom entry needs a section to sit under,
// and nothing in the app makes one yet.
export function creatableKinds(store: Store): CareerRecordKind[] {
  const hasSection = live(store.customSections).length > 0;
  return CAREER_RECORD_KINDS.filter((kind) => kind !== "custom_entry" || hasSection);
}

function trimmed(value: string): string | null {
  const text = value.trim();
  return text === "" ? null : text;
}

function fieldErrors(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    errors[key] ??= issue.message;
  }
  return errors;
}

function columnsOf(values: RecordFormValues): Record<string, string | null> {
  return Object.fromEntries(
    EXTRA_FIELDS[values.kind].map((field) => [
      field.name,
      trimmed(values.extras[field.name] ?? ""),
    ]),
  );
}

function sharedColumns(values: RecordFormValues, organisationId: Uuid | null) {
  return {
    kind: values.kind,
    title: trimmed(values.title),
    subtitle: trimmed(values.subtitle),
    organisationId,
    startedOn: trimmed(values.startedOn),
    endedOn: trimmed(values.endedOn),
    isCurrent: values.isCurrent,
    location: trimmed(values.location),
    ...columnsOf(values),
  };
}

function namedOrganisation(store: Store, name: string) {
  const wanted = name.trim().toLowerCase();
  return store.organisations.find((row) => row.name.trim().toLowerCase() === wanted);
}

function organisationFor(
  store: Store,
  name: string,
): { id: Uuid | null; created: OrganisationInput | null } {
  const text = name.trim();
  if (text === "") return { id: null, created: null };

  const existing = namedOrganisation(store, text);
  if (existing !== undefined) return { id: existing.id, created: null };

  const created: OrganisationInput = {
    id: newUuid(),
    name: text,
    kind: "company",
    website: null,
    industry: null,
    location: null,
  };
  return { id: created.id, created };
}

export function buildSubmission(
  store: Store,
  values: RecordFormValues,
): { submission: RecordSubmission } | { errors: FieldErrors } {
  const organisation = organisationFor(store, values.organisation);
  const parsed = careerRecordInputSchema.safeParse({
    id: newUuid(),
    sortKey: nextSortKey(store.records),
    summarySetId: null,
    ...sharedColumns(values, organisation.id),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  return { submission: { record: parsed.data, organisation: organisation.created } };
}

export interface Difference {
  label: string;
  mine: string;
  theirs: string;
}

const SHARED_LABELS: Record<string, string> = {
  title: "Title",
  subtitle: "Subtitle",
  organisation: "Organisation",
  startedOn: "Started",
  endedOn: "Ended",
  location: "Location",
};

// What each side says, field by field. A stale write is never resolved by
// silently keeping one of them (application-structure.md #4).
export function differences(
  store: Store,
  mine: RecordFormValues,
  current: CareerRecord,
): Difference[] {
  const theirs = valuesOf(store, current);
  const shown = (value: string): string => (value === "" ? "empty" : value);

  const shared = Object.entries(SHARED_LABELS).flatMap(([name, label]) => {
    const a = mine[name as keyof RecordFormValues];
    const b = theirs[name as keyof RecordFormValues];
    return a === b || typeof a !== "string" || typeof b !== "string"
      ? []
      : [{ label, mine: shown(a), theirs: shown(b) }];
  });

  const ongoing =
    mine.isCurrent === theirs.isCurrent
      ? []
      : [
          {
            label: "Ongoing",
            mine: mine.isCurrent ? "yes" : "no",
            theirs: theirs.isCurrent ? "yes" : "no",
          },
        ];

  const extras = EXTRA_FIELDS[mine.kind].flatMap((field) => {
    const a = mine.extras[field.name] ?? "";
    const b = theirs.extras[field.name] ?? "";
    return a === b ? [] : [{ label: field.label, mine: shown(a), theirs: shown(b) }];
  });

  return [...shared, ...ongoing, ...extras];
}

// No `summarySetId` and no `sortKey`: absent leaves them alone, and sending
// either would clear a summary or reorder the list the form never showed.
export function buildPatch(
  store: Store,
  values: RecordFormValues,
): { patch: CareerRecordPatch; organisation: OrganisationInput | null } | { errors: FieldErrors } {
  const organisation = organisationFor(store, values.organisation);
  const parsed = careerRecordPatchSchema.safeParse(sharedColumns(values, organisation.id));

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  return { patch: parsed.data, organisation: organisation.created };
}
