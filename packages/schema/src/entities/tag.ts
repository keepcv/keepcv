import { z } from "zod";
import { uuidSchema } from "../primitives/uuid.js";
import { standardFields } from "./standard-fields.js";

export const tagSchema = z
  .object({
    ...standardFields,
    // Derived from the label on write and never sent (data-model.md I17).
    slug: z.string().min(1),
    label: z.string().min(1),
    category: z.string().min(1).nullable(),
  })
  .meta({ id: "Tag", title: "Tag" });

export const tagInputSchema = tagSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  slug: true,
});

export const tagPatchSchema = tagInputSchema.omit({ id: true }).partial();

// The pair is the whole row, so it has no id and no lifecycle.
export const recordTagSchema = z
  .object({
    tagId: uuidSchema,
    recordId: uuidSchema,
  })
  .meta({ id: "RecordTag", title: "Record tag" });

export const pointTagSchema = z
  .object({
    tagId: uuidSchema,
    pointId: uuidSchema,
  })
  .meta({ id: "PointTag", title: "Point tag" });

export type Tag = z.infer<typeof tagSchema>;
export type TagInput = z.infer<typeof tagInputSchema>;
export type TagPatch = z.infer<typeof tagPatchSchema>;
export type RecordTag = z.infer<typeof recordTagSchema>;
export type PointTag = z.infer<typeof pointTagSchema>;
