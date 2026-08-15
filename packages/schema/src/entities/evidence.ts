import { z } from "zod";
import { uuidSchema } from "../primitives/uuid.js";
import { standardFields } from "./standard-fields.js";

export const EVIDENCE_KINDS = ["url", "note", "file"] as const;

export const evidenceKindSchema = z.enum(EVIDENCE_KINDS);

// What backs a point up, and PRIVATE: no renderer can leak it because
// `ResumeDocument` has no field it could travel in (template-model.md #2). It is
// in the native export in full all the same - private means never printed, not
// withheld from the user, and it is the user's own data.
//
// Unordered, so no sort key: evidence is a set of supports, not a list someone
// arranges.
export const evidenceSchema = z
  .object({
    ...standardFields,
    pointId: uuidSchema,
    kind: evidenceKindSchema,
    value: z.string().min(1),
    note: z.string().nullable(),
  })
  .meta({ id: "Evidence", title: "Evidence" });

export const evidenceInputSchema = evidenceSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const evidencePatchSchema = evidenceInputSchema.omit({ id: true, pointId: true }).partial();

export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type EvidenceInput = z.infer<typeof evidenceInputSchema>;
export type EvidencePatch = z.infer<typeof evidencePatchSchema>;
