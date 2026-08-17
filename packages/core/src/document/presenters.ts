import type { CareerRecord, CareerRecordKind, DocumentField, DocumentPeriod } from "@keepcv/schema";
import { formatPartialDate, formatPeriod } from "./format.js";

export interface Presented {
  title?: string;
  subtitle?: string;
  mode?: string;
  period?: DocumentPeriod;
  fields: DocumentField[];
}

type RecordOfKind<K extends CareerRecordKind> = Extract<CareerRecord, { kind: K }>;

type Presenters = {
  [K in CareerRecordKind]: (record: RecordOfKind<K>, locale: string) => Presented;
};

function optional<K extends string>(key: K, value: string | null): Partial<Record<K, string>> {
  return value === null || value === "" ? {} : ({ [key]: value } as Record<K, string>);
}

function field(
  key: string,
  label: string,
  value: string | null,
  kind: DocumentField["kind"] = "text",
): DocumentField[] {
  return value === null || value === "" ? [] : [{ key, label, value, kind }];
}

function capitalised(value: string): string {
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}

function slots(record: CareerRecord, locale: string): Presented {
  const period = formatPeriod(record.startedOn, record.endedOn, record.isCurrent, locale);
  return {
    ...optional("title", record.title),
    ...optional("subtitle", record.subtitle),
    ...(period === undefined ? {} : { period }),
    fields: [],
  };
}

// template-model.md #6. Adding a record kind adds one of these and one row to
// that table, and touches no template.
const PRESENTERS: Presenters = {
  experience: (record, locale) => ({
    ...slots(record, locale),
    // A slot, never a field: nothing may occupy both (template-model.md #6).
    ...optional("mode", record.mode === null ? null : capitalised(record.mode)),
    fields: field("employmentType", "Employment type", record.employmentType),
  }),

  education: (record, locale) => ({
    ...slots(record, locale),
    fields: [
      ...field(
        "grade",
        "Grade",
        record.gradeScale === null || record.grade === null
          ? record.grade
          : `${record.grade} (${record.gradeScale})`,
      ),
      ...field("thesisTitle", "Thesis", record.thesisTitle),
      ...field("honours", "Honours", record.honours),
    ],
  }),

  project: slots,

  skill: (record, locale) => ({
    ...slots(record, locale),
    ...optional("subtitle", record.proficiency === null ? null : capitalised(record.proficiency)),
    fields: field("category", "Category", record.category),
  }),

  certification: (record, locale) => ({
    ...slots(record, locale),
    fields: [
      ...field("credentialId", "Credential ID", record.credentialId),
      ...field(
        "expiresOn",
        "Expires",
        record.expiresOn === null ? null : formatPartialDate(record.expiresOn, locale),
        "date",
      ),
    ],
  }),

  publication: (record, locale) => ({
    ...slots(record, locale),
    fields: field("doi", "DOI", record.doi),
  }),

  award: slots,

  // The one kind with no period: a language is not something you started.
  language: (record, locale) => {
    const { period: _held, ...rest } = slots(record, locale);
    return { ...rest, ...optional("subtitle", record.proficiency) };
  },

  volunteering: slots,
  speaking: slots,
  custom_entry: slots,
};

export function present(record: CareerRecord, locale: string): Presented {
  const presenter = PRESENTERS[record.kind] as (record: CareerRecord, locale: string) => Presented;
  return presenter(record, locale);
}

export const PRESENTED_KINDS = Object.keys(PRESENTERS) as CareerRecordKind[];
