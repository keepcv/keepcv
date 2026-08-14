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

// One set per thing that can be said more than one way. `canonicalPhrasingId` is
// which wording is used when nobody has chosen: a pointer rather than a variant
// value, so promoting a wording is one write and does not force the demoted one
// to be relabelled (data-model.md #5).
export const phrasingSetSchema = z
  .object({
    ...standardFields,
    purpose: phrasingPurposeSchema,
    canonicalPhrasingId: uuidSchema.nullable(),
  })
  .meta({ id: "PhrasingSet", title: "Phrasing set" });

// `variant` is structural and drives selection and length estimation; `label` is
// the user's own name for this wording. There is no text here - text lives in
// revisions, which is what makes it append-only.
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

// Immutable, so no `updatedAt` and no `archivedAt`. `plainText`, `charCount` and
// `contentHash` are derived from `body` and travel with it so a reader needs no
// rich-text implementation to search, lint or estimate length.
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

// A phrasing arrives with the text it is being created to hold, because a
// phrasing with no revision is a wording with nothing in it.
export const newPhrasingSchema = z.object({
  id: uuidSchema,
  variant: phrasingVariantSchema,
  label: z.string().nullable(),
  sortKey: sortKeySchema,
  body: richTextSchema,
});

export const phrasingInputSchema = newPhrasingSchema.extend({ phrasingSetId: uuidSchema });

// A set is never created empty either: its first phrasing goes in with it, in one
// transaction, and becomes the canonical one.
export const phrasingSetInputSchema = z.object({
  id: uuidSchema,
  purpose: phrasingPurposeSchema,
  phrasing: newPhrasingSchema,
});

// No `body`: text changes only by appending a revision, so a patch that could
// carry it would be a second way to do it, and the one that loses history.
export const phrasingPatchSchema = newPhrasingSchema.omit({ id: true, body: true }).partial();

// `purpose` never changes, and the canonical pointer never goes back to null once
// a set has a phrasing.
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
