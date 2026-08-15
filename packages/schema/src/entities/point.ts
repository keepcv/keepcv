import { z } from "zod";
import { partialDateSchema } from "../primitives/partial-date.js";
import { sortKeySchema } from "../primitives/sort-key.js";
import { uuidSchema } from "../primitives/uuid.js";
import { newPhrasingSchema } from "./phrasing.js";
import { standardFields } from "./standard-fields.js";

export const POINT_CONFIDENCES = ["verified", "estimated", "unverified"] as const;

export const pointConfidenceSchema = z.enum(POINT_CONFIDENCES);

// The atomic content unit - never "achievement", "bullet" or "highlight". One
// primitive with optional facets rather than a family of near-identical types,
// which is what lets a template iterate points without knowing which section it
// is in. `recordId` is nullable so a point can be captured before it is decided
// where it belongs.
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

// A point arrives with the words it exists to hold: its phrasing set is created
// with it, in one transaction, so a point with nothing to say is not a state
// anyone can reach. Both ids are the caller's, as everywhere else.
export const pointInputSchema = pointSchema
  .omit({ createdAt: true, updatedAt: true, archivedAt: true })
  .extend({ phrasing: newPhrasingSchema });

// No `phrasingSetId`: text changes by appending a revision to the set the point
// already has, never by pointing the point at a different one.
export const pointPatchSchema = pointInputSchema
  .omit({ id: true, phrasingSetId: true, phrasing: true })
  .partial();

// A point's secondary parents. `Point.recordId` decides where it prints; these
// say it also relates to a record, which is what discovery and selection read.
// The pair is the whole row - a link holds nothing of its own, so it has no id
// and no lifecycle.
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
