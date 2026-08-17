import { z } from "zod";
import { partialDateSchema } from "../primitives/partial-date.js";
import { sortKeySchema } from "../primitives/sort-key.js";
import { uuidSchema } from "../primitives/uuid.js";
import { newPhrasingSchema } from "./phrasing.js";
import { standardFields } from "./standard-fields.js";

export const POINT_CONFIDENCES = ["verified", "estimated", "unverified"] as const;

export const pointConfidenceSchema = z.enum(POINT_CONFIDENCES);

// The atomic content unit - never "achievement", "bullet" or "highlight".
export const pointSchema = z
  .object({
    ...standardFields,
    recordId: uuidSchema.nullable(),
    phrasingSetId: uuidSchema,
    confidence: pointConfidenceSchema,
    occurredOn: partialDateSchema.nullable(),
    sortKey: sortKeySchema,
  })
  .meta({ id: "Point", title: "Point" });

export const pointInputSchema = pointSchema
  .omit({ createdAt: true, updatedAt: true, archivedAt: true })
  .extend({ phrasing: newPhrasingSchema });

// No `phrasingSetId`: text changes by appending a revision, never by repointing.
export const pointPatchSchema = pointInputSchema
  .omit({ id: true, phrasingSetId: true, phrasing: true })
  .partial();

// The pair is the whole row, so it has no id and no lifecycle.
export const pointRecordLinkSchema = z
  .object({
    pointId: uuidSchema,
    recordId: uuidSchema,
  })
  .meta({ id: "PointRecordLink", title: "Point record link" });

export type PointConfidence = z.infer<typeof pointConfidenceSchema>;
export type Point = z.infer<typeof pointSchema>;
export type PointInput = z.infer<typeof pointInputSchema>;
export type PointPatch = z.infer<typeof pointPatchSchema>;
export type PointRecordLink = z.infer<typeof pointRecordLinkSchema>;
