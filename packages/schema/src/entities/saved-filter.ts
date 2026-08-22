import { z } from "zod";
import { sortKeySchema } from "../primitives/sort-key.js";
import { uuidSchema } from "../primitives/uuid.js";
import { careerRecordKindSchema } from "./career-record.js";
import { standardFields } from "./standard-fields.js";

export const FILTER_SUBJECTS = ["record", "point"] as const;
export const ARCHIVED_SCOPES = ["exclude", "include", "only"] as const;

// What a list narrows by that is a fact about the store rather than a mode of
// the screen: a point with no record and a point with no metric are both things
// the store can answer (data-model.md #8.1).
export const UNFINISHED_KINDS = ["unplaced", "unmeasured"] as const;

export const filterSubjectSchema = z.enum(FILTER_SUBJECTS);
export const archivedScopeSchema = z.enum(ARCHIVED_SCOPES);
export const unfinishedKindSchema = z.enum(UNFINISHED_KINDS);

export const savedFilterSchema = z
  .object({
    ...standardFields,
    name: z.string().min(1),
    subject: filterSubjectSchema,
    query: z.string(),
    kind: careerRecordKindSchema.nullable(),
    tagId: uuidSchema.nullable(),
    archived: archivedScopeSchema,
    unfinished: unfinishedKindSchema.nullable(),
    sortKey: sortKeySchema,
  })
  .meta({ id: "SavedFilter", title: "Saved filter" });

export const savedFilterInputSchema = savedFilterSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const savedFilterPatchSchema = savedFilterInputSchema.omit({ id: true }).partial();

export type FilterSubject = z.infer<typeof filterSubjectSchema>;
export type ArchivedScope = z.infer<typeof archivedScopeSchema>;
export type UnfinishedKind = z.infer<typeof unfinishedKindSchema>;
export type SavedFilter = z.infer<typeof savedFilterSchema>;
export type SavedFilterInput = z.infer<typeof savedFilterInputSchema>;
export type SavedFilterPatch = z.infer<typeof savedFilterPatchSchema>;
