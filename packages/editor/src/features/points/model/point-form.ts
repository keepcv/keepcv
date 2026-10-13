import { keyForPosition, newUuid, textOfPoint } from "@keepcv/core";
import type {
  MetricInput,
  Point,
  PointConfidence,
  PointInput,
  PointPatch,
  Store,
  Uuid,
} from "@keepcv/schema";
import {
  metricInputSchema,
  POINT_CONFIDENCES,
  pointInputSchema,
  pointPatchSchema,
} from "@keepcv/schema";
import { z } from "zod";
import { type FieldErrors, fieldErrors } from "../../../lib/form.js";
import { bodyOf } from "../../phrasings/model/editor.js";

export const CONFIDENCE_HINTS: Record<PointConfidence, string> = {
  verified: "Supported by evidence.",
  estimated: "An approximate figure.",
  unverified: "Not yet checked.",
};

export const pointFormValuesSchema = z.object({
  text: z.string(),
  recordId: z.string(),
  confidence: z.enum(POINT_CONFIDENCES),
  occurredOn: z.string(),
});

export const pointPlacementValuesSchema = pointFormValuesSchema.omit({ text: true });
export type PointPlacementValues = z.infer<typeof pointPlacementValuesSchema>;

export type PointFormValues = z.infer<typeof pointFormValuesSchema>;

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

function columns(values: PointPlacementValues) {
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
    sortKey: keyForPosition(store.points, null, store.points.length),
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
  values: PointPlacementValues,
): { patch: PointPatch } | { errors: FieldErrors } {
  const parsed = pointPatchSchema.safeParse(columns(values));
  return parsed.success ? { patch: parsed.data } : { errors: fieldErrors(parsed.error) };
}

export const metricFormValuesSchema = z.object({
  label: z.string(),
  value: z.string(),
  unit: z.string(),
  baseline: z.string(),
});
export type MetricFormValues = z.infer<typeof metricFormValuesSchema>;

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

  const metrics = store.metrics.filter((row) => row.pointId === pointId);
  const parsed = metricInputSchema.safeParse({
    id: newUuid(),
    pointId,
    label: values.label.trim(),
    value,
    unit: values.unit.trim() === "" ? null : values.unit.trim(),
    baseline,
    direction: null,
    period: null,
    sortKey: keyForPosition(metrics, null, metrics.length),
  });

  return parsed.success ? { metric: parsed.data } : { errors: fieldErrors(parsed.error) };
}
