import { z } from "zod";
import { uuidSchema } from "../primitives/uuid.js";
import { standardFields } from "./standard-fields.js";

export const EVIDENCE_KINDS = ["url", "note", "file"] as const;

export const evidenceKindSchema = z.enum(EVIDENCE_KINDS);

// PRIVATE and never rendered: `ResumeDocument` has no field it could travel in
// (template-model.md #2). It is in the native export all the same.
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
