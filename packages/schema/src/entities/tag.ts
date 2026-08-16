import { z } from "zod";
import { uuidSchema } from "../primitives/uuid.js";
import { standardFields } from "./standard-fields.js";

// A controlled vocabulary rather than free strings on each row, so renaming one
// is a single write and merging two is an operation rather than a find-and-
// replace nobody can undo (data-model.md #8).
export const tagSchema = z
  .object({
    ...standardFields,
    // Derived from the label at write time and never sent, like a revision's
    // plain text: it is the projection uniqueness is enforced on, so "React",
    // "react" and " React " cannot become three tags meaning one thing.
    slug: z.string().min(1),
    label: z.string().min(1),
    // Free text rather than an enum: "skill", "domain" and "competency" are the
    // ones we suggest, and the vocabulary is the user's to extend.
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

// Two join tables rather than one polymorphic one, so both sides keep a real
// foreign key. The pair is the whole row, as it is for a point's secondary
// records: untagging destroys nothing the user wrote and both ends survive.
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
