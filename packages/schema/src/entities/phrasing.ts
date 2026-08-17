import { z } from "zod";
import { contentHashSchema } from "../primitives/content-hash.js";
import { richTextSchema } from "../primitives/rich-text.js";
import { sortKeySchema } from "../primitives/sort-key.js";
import { timestampSchema } from "../primitives/timestamp.js";
import { uuidSchema } from "../primitives/uuid.js";
import { standardFields } from "./standard-fields.js";

export const PHRASING_PURPOSES = ["point", "profile_summary", "record_summary"] as const;
export const PHRASING_VARIANTS = ["standard", "short", "long", "angled"] as const;

export const phrasingPurposeSchema = z.enum(PHRASING_PURPOSES);
export const phrasingVariantSchema = z.enum(PHRASING_VARIANTS);

export const phrasingSetSchema = z
  .object({
    ...standardFields,
    purpose: phrasingPurposeSchema,
    canonicalPhrasingId: uuidSchema.nullable(),
  })
  .meta({ id: "PhrasingSet", title: "Phrasing set" });

// No text here: it lives in revisions, which is what makes it append-only.
export const phrasingSchema = z
  .object({
    ...standardFields,
    phrasingSetId: uuidSchema,
    variant: phrasingVariantSchema,
    label: z.string().nullable(),
    sortKey: sortKeySchema,
    currentRevisionId: uuidSchema.nullable(),
  })
  .meta({ id: "Phrasing", title: "Phrasing" });

// Immutable, so no `updatedAt` and no `archivedAt` (data-model.md I2).
export const phrasingRevisionSchema = z
  .object({
    id: uuidSchema,
    createdAt: timestampSchema,
    phrasingId: uuidSchema,
    body: richTextSchema,
    plainText: z.string(),
    charCount: z.int().min(0),
    contentHash: contentHashSchema,
  })
  .meta({ id: "PhrasingRevision", title: "Phrasing revision" });

export const newPhrasingSchema = z.object({
  id: uuidSchema,
  variant: phrasingVariantSchema,
  label: z.string().nullable(),
  sortKey: sortKeySchema,
  body: richTextSchema,
});

export const phrasingInputSchema = newPhrasingSchema.extend({ phrasingSetId: uuidSchema });

export const phrasingSetInputSchema = z.object({
  id: uuidSchema,
  purpose: phrasingPurposeSchema,
  phrasing: newPhrasingSchema,
});

// No `body`: a patch that could carry text would be the way that loses history.
export const phrasingPatchSchema = newPhrasingSchema.omit({ id: true, body: true }).partial();

export const phrasingSetPatchSchema = z.object({ canonicalPhrasingId: uuidSchema }).partial();

export type PhrasingPurpose = z.infer<typeof phrasingPurposeSchema>;
export type PhrasingVariant = z.infer<typeof phrasingVariantSchema>;
export type PhrasingSet = z.infer<typeof phrasingSetSchema>;
export type Phrasing = z.infer<typeof phrasingSchema>;
export type PhrasingRevision = z.infer<typeof phrasingRevisionSchema>;
export type NewPhrasing = z.infer<typeof newPhrasingSchema>;
export type PhrasingInput = z.infer<typeof phrasingInputSchema>;
export type PhrasingSetInput = z.infer<typeof phrasingSetInputSchema>;
export type PhrasingPatch = z.infer<typeof phrasingPatchSchema>;
export type PhrasingSetPatch = z.infer<typeof phrasingSetPatchSchema>;
