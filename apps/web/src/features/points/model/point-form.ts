import { live, newUuid, textOfPoint } from "@keepcv/core";
import type {
  MetricInput,
  Point,
  PointConfidence,
  PointInput,
  PointPatch,
  RichText,
  Store,
  Uuid,
} from "@keepcv/schema";
import { metricInputSchema, pointInputSchema, pointPatchSchema } from "@keepcv/schema";
import type { ZodError } from "zod";
import { nextSortKey } from "../../../lib/sort.js";

export const CONFIDENCE_HINTS: Record<PointConfidence, string> = {
  verified: "Backed by something you could show.",
  estimated: "Your own figure, honestly arrived at.",
  unverified: "True, but nothing to point at.",
};

export interface PointFormValues {
  text: string;
  // "" is unplaced, which is a state the store is built to hold: capture first,
  // decide where it belongs later.
  recordId: string;
  confidence: PointConfidence;
  occurredOn: string;
}

export type FieldErrors = Record<string, string>;

export function blankPointValues(recordId?: Uuid): PointFormValues {
  return { text: "", recordId: recordId ?? "", confidence: "unverified", occurredOn: "" };
}

export function pointValuesOf(store: Store, point: Point): PointFormValues {
  return {
    text: textOfPoint(store, point),
    recordId: point.recordId ?? "",
    confidence: point.confidence,
    occurredOn: point.occurredOn ?? "",
  };
}

function fieldErrors(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    errors[issue.path.map(String).join(".")] ??= issue.message;
  }
  return errors;
}

// One paragraph and no marks yet: the editor that produces the rest is its own
// piece of work (application-structure.md #6).
export function bodyOf(text: string): RichText {
  const trimmed = text.trim();
  return trimmed === "" ? [] : [{ t: "text", v: trimmed }];
}

function columns(values: PointFormValues) {
  return {
    recordId: values.recordId === "" ? null : values.recordId,
    confidence: values.confidence,
    occurredOn: values.occurredOn.trim() === "" ? null : values.occurredOn.trim(),
  };
}

// The whole chain in one body: a point arrives with the words it holds, so the
// set, the phrasing and the first revision are the store's to make together.
export function buildPointSubmission(
  store: Store,
  values: PointFormValues,
): { point: PointInput } | { errors: FieldErrors } {
  const parsed = pointInputSchema.safeParse({
    id: newUuid(),
    phrasingSetId: newUuid(),
    sortKey: nextSortKey(store.points),
    ...columns(values),
    phrasing: {
      id: newUuid(),
      variant: "standard",
      label: null,
      sortKey: "a0",
      body: bodyOf(values.text),
    },
  });

  return parsed.success ? { point: parsed.data } : { errors: fieldErrors(parsed.error) };
}

export function buildPointPatch(
  values: PointFormValues,
): { patch: PointPatch } | { errors: FieldErrors } {
  const parsed = pointPatchSchema.safeParse(columns(values));
  return parsed.success ? { patch: parsed.data } : { errors: fieldErrors(parsed.error) };
}

// The phrasing an edit appends to. A point whose set has no canonical phrasing
// has nothing to revise, and the editor has to be able to say so.
export function canonicalPhrasingId(store: Store, point: Point): Uuid | undefined {
  const set = store.phrasingSets.find((row) => row.id === point.phrasingSetId);
  return set?.canonicalPhrasingId ?? undefined;
}

// Null when the words did not change: text is append-only, and retyping a word
// and undoing it must not add to the history.
export function changedBody(store: Store, point: Point, text: string): RichText | null {
  return textOfPoint(store, point) === text.trim() ? null : bodyOf(text);
}

export interface MetricFormValues {
  label: string;
  value: string;
  unit: string;
  baseline: string;
}

export const BLANK_METRIC: MetricFormValues = { label: "", value: "", unit: "", baseline: "" };

function optionalNumber(value: string): number | null | undefined {
  const text = value.trim();
  if (text === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function buildMetric(
  store: Store,
  pointId: Uuid,
  values: MetricFormValues,
): { metric: MetricInput } | { errors: FieldErrors } {
  const baseline = optionalNumber(values.baseline);
  if (baseline === undefined) return { errors: { baseline: "expected a number" } };

  const value = optionalNumber(values.value);
  if (value === undefined || value === null) return { errors: { value: "expected a number" } };

  const parsed = metricInputSchema.safeParse({
    id: newUuid(),
    pointId,
    label: values.label.trim(),
    value,
    unit: values.unit.trim() === "" ? null : values.unit.trim(),
    baseline,
    direction: null,
    period: null,
    sortKey: nextSortKey(live(store.metrics).filter((row) => row.pointId === pointId)),
  });

  return parsed.success ? { metric: parsed.data } : { errors: fieldErrors(parsed.error) };
}
