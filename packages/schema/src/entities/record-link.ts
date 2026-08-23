import { z } from "zod";
import { sortKeySchema } from "../primitives/sort-key.js";
import { uuidSchema } from "../primitives/uuid.js";
import { standardFields } from "./standard-fields.js";

export const RECORD_LINK_KINDS = ["repo", "demo", "docs", "verify", "recording", "other"] as const;

export const recordLinkKindSchema = z.enum(RECORD_LINK_KINDS);

// A URL is a link; a labelled value is a field.
export const recordLinkSchema = z
  .object({
    ...standardFields,
    recordId: uuidSchema,
    kind: recordLinkKindSchema,
    label: z.string().nullable(),
    url: z.string().min(1),
    sortKey: sortKeySchema,
  })
  .meta({ id: "RecordLink", title: "Record link" });

export const recordLinkInputSchema = recordLinkSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const recordLinkPatchSchema = recordLinkInputSchema
  .omit({ id: true, recordId: true })
  .partial();

export type RecordLinkKind = z.infer<typeof recordLinkKindSchema>;
export type RecordLink = z.infer<typeof recordLinkSchema>;
export type RecordLinkInput = z.infer<typeof recordLinkInputSchema>;
export type RecordLinkPatch = z.infer<typeof recordLinkPatchSchema>;
