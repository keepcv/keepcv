import { z } from "zod";
import { sectionKindSchema } from "../entities/resume.js";
import { uuidSchema } from "../primitives/uuid.js";

export const CHANGE_KINDS = ["added", "removed", "moved", "changed"] as const;

export const changeKindSchema = z.enum(CHANGE_KINDS);

export const fieldChangeSchema = z
  .object({
    field: z.string(),
    a: z.string().nullable(),
    b: z.string().nullable(),
  })
  .meta({ id: "FieldChange", title: "Changed field" });

// A point has no title, so the wording is how it is named. It is here as well
// as in `fields` because a point can change without its words changing at all.
export const pointChangeSchema = z
  .object({
    pointId: uuidSchema,
    text: z.string().nullable(),
    change: changeKindSchema,
    aIndex: z.int().nonnegative().nullable(),
    bIndex: z.int().nonnegative().nullable(),
    fields: z.array(fieldChangeSchema),
  })
  .meta({ id: "PointChange", title: "Changed point" });

// The title is what the entry printed as, not what the record says now: a title
// corrected since is the change being reported, so reading it live would hide
// it.
export const entryChangeSchema = z
  .object({
    recordId: uuidSchema,
    title: z.string().nullable(),
    change: changeKindSchema,
    aIndex: z.int().nonnegative().nullable(),
    bIndex: z.int().nonnegative().nullable(),
    fields: z.array(fieldChangeSchema),
    points: z.array(pointChangeSchema),
  })
  .meta({ id: "EntryChange", title: "Changed entry" });

export const sectionChangeSchema = z
  .object({
    kind: sectionKindSchema,
    heading: z.string(),
    change: changeKindSchema,
    aIndex: z.int().nonnegative().nullable(),
    bIndex: z.int().nonnegative().nullable(),
    fields: z.array(fieldChangeSchema),
    entries: z.array(entryChangeSchema),
  })
  .meta({ id: "SectionChange", title: "Changed section" });

// Only what differs: a level with nothing to say is absent, so an empty diff at
// all three keys is two versions that print the same.
export const manifestDiffSchema = z
  .object({
    target: z.array(fieldChangeSchema),
    profile: z.array(fieldChangeSchema),
    sections: z.array(sectionChangeSchema),
  })
  .meta({ id: "ManifestDiff", title: "Manifest diff" });

export type ChangeKind = z.infer<typeof changeKindSchema>;
export type FieldChange = z.infer<typeof fieldChangeSchema>;
export type PointChange = z.infer<typeof pointChangeSchema>;
export type EntryChange = z.infer<typeof entryChangeSchema>;
export type SectionChange = z.infer<typeof sectionChangeSchema>;
export type ManifestDiff = z.infer<typeof manifestDiffSchema>;
