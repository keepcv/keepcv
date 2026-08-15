import { z } from "zod";
import { sortKeySchema } from "../primitives/sort-key.js";
import { uuidSchema } from "../primitives/uuid.js";
import { standardFields } from "./standard-fields.js";

export const METRIC_DIRECTIONS = ["increase", "decrease", "neutral"] as const;

export const metricDirectionSchema = z.enum(METRIC_DIRECTIONS);

// A number a point moved, structured rather than buried in its prose, so "show
// me everything where I moved a percentage" is a query. Finite because the store
// is exported as JSON, which has no way to write an infinity back.
export const metricSchema = z
  .object({
    ...standardFields,
    pointId: uuidSchema,
    label: z.string().min(1),
    value: z.number().finite(),
    unit: z.string().nullable(),
    baseline: z.number().finite().nullable(),
    direction: metricDirectionSchema.nullable(),
    period: z.string().nullable(),
    sortKey: sortKeySchema,
  })
  .meta({ id: "Metric", title: "Metric" });

export const metricInputSchema = metricSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const metricPatchSchema = metricInputSchema.omit({ id: true, pointId: true }).partial();

export type MetricDirection = z.infer<typeof metricDirectionSchema>;
export type Metric = z.infer<typeof metricSchema>;
export type MetricInput = z.infer<typeof metricInputSchema>;
export type MetricPatch = z.infer<typeof metricPatchSchema>;
