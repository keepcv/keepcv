import { z } from "zod";
import { sortKeySchema } from "../primitives/sort-key.js";
import { uuidSchema } from "../primitives/uuid.js";
import { standardFields } from "./standard-fields.js";

export const RECORD_FIELD_VALUE_KINDS = ["text", "url", "date", "number"] as const;

export const recordFieldValueKindSchema = z.enum(RECORD_FIELD_VALUE_KINDS);

// A labelled value on any record kind. `key` is what a specialised template
// addresses; typed columns like `doi` reach the same slot through their
// presenter, so a template sees one uniform list either way (template-model.md
// #3). Deriving a key from a user's label, and resolving a collision with a
// presenter's key, both belong to the layers that have those two things.
export const recordFieldSchema = z
  .object({
    ...standardFields,
    recordId: uuidSchema,
    key: z.string().min(1),
    label: z.string().min(1),
    value: z.string(),
    valueKind: recordFieldValueKindSchema,
    sortKey: sortKeySchema,
  })
  .meta({ id: "RecordField", title: "Record field" });

export const recordFieldInputSchema = recordFieldSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const recordFieldPatchSchema = recordFieldInputSchema
  .omit({ id: true, recordId: true })
  .partial();

export type RecordFieldValueKind = z.infer<typeof recordFieldValueKindSchema>;
export type RecordField = z.infer<typeof recordFieldSchema>;
export type RecordFieldInput = z.infer<typeof recordFieldInputSchema>;
export type RecordFieldPatch = z.infer<typeof recordFieldPatchSchema>;
