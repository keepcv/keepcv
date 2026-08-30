import { keyForPosition, newUuid } from "@keepcv/core";
import type {
  RecordField,
  RecordFieldInput,
  RecordFieldPatch,
  RecordFieldValueKind,
  RecordLinkInput,
  RecordLinkKind,
  Store,
  Uuid,
} from "@keepcv/schema";
import {
  RECORD_FIELD_VALUE_KINDS,
  RECORD_LINK_KINDS,
  recordFieldInputSchema,
  recordLinkInputSchema,
} from "@keepcv/schema";
import { type FieldErrors, fieldErrors } from "../../../lib/form.js";

const titleCase = (word: string): string => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;

export const LINK_KIND_OPTIONS = RECORD_LINK_KINDS.map((kind) => ({
  value: kind,
  label: titleCase(kind),
}));

export const VALUE_KIND_OPTIONS = RECORD_FIELD_VALUE_KINDS.map((kind) => ({
  value: kind,
  label: titleCase(kind),
}));

export interface LinkFormValues {
  kind: RecordLinkKind;
  label: string;
  url: string;
}

export const BLANK_LINK: LinkFormValues = { kind: "repo", label: "", url: "" };

export function buildLink(
  store: Store,
  recordId: Uuid,
  values: LinkFormValues,
): { link: RecordLinkInput } | { errors: FieldErrors } {
  // Archived rows keep their keys, and `record_link_sort_key_unique` covers
  // them, so the whole collection decides the next one.
  const rows = store.recordLinks.filter((row) => row.recordId === recordId);
  const parsed = recordLinkInputSchema.safeParse({
    id: newUuid(),
    recordId,
    kind: values.kind,
    label: values.label.trim() === "" ? null : values.label.trim(),
    url: values.url.trim(),
    sortKey: keyForPosition(rows, null, rows.length),
  });

  return parsed.success ? { link: parsed.data } : { errors: fieldErrors(parsed.error) };
}

export interface RecordFieldFormValues {
  label: string;
  value: string;
  valueKind: RecordFieldValueKind;
}

export const BLANK_FIELD: RecordFieldFormValues = { label: "", value: "", valueKind: "text" };

// Derived rather than asked for: `key` is what a specialised template addresses
// and what an importer matches on, and nobody types one by choice.
function keyFor(label: string): string {
  return label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

export type FieldPlan =
  | { create: RecordFieldInput }
  | { restore: RecordField; patch: RecordFieldPatch }
  | { errors: FieldErrors };

export function buildField(store: Store, recordId: Uuid, values: RecordFieldFormValues): FieldPlan {
  const key = keyFor(values.label);
  if (key === "") return { errors: { label: "give it a name letters can be taken from" } };

  const label = values.label.trim();
  const value = values.value.trim();
  const rows = store.recordFields.filter((row) => row.recordId === recordId);
  const held = rows.find((row) => row.key === key);

  // `record_field_key_unique` covers archived rows, so a field removed and
  // named again is the same field put back rather than a second one.
  if (held !== undefined) {
    if (held.archivedAt === null) return { errors: { label: "this record already carries that" } };
    return { restore: held, patch: { label, value, valueKind: values.valueKind } };
  }

  const parsed = recordFieldInputSchema.safeParse({
    id: newUuid(),
    recordId,
    key,
    label,
    value,
    valueKind: values.valueKind,
    sortKey: keyForPosition(rows, null, rows.length),
  });

  return parsed.success ? { create: parsed.data } : { errors: fieldErrors(parsed.error) };
}
