import { z } from "zod";
import { timestampSchema } from "../primitives/timestamp.js";
import { uuidSchema } from "../primitives/uuid.js";

// Only kinds with a table: the store checks the target exists, and nothing can
// check a kind that has none. `resume` joins this when resumes exist.
export const DRAFT_TARGET_KINDS = ["phrasing", "record"] as const;

export const draftTargetKindSchema = z.enum(DRAFT_TARGET_KINDS);

// A path segment, so it may not carry a separator.
export const draftTargetSchema = z
  .object({
    targetKind: draftTargetKindSchema,
    targetId: uuidSchema,
    field: z
      .string()
      .max(64)
      .regex(
        /^[a-zA-Z][a-zA-Z0-9-]*$/,
        "a field name is a letter followed by letters, digits or -",
      ),
  })
  .meta({ id: "DraftTarget", title: "Draft target" });

// Unvalidated: checking it against the shape it will commit to would reject the
// half-written state this table exists to keep.
export const draftBodySchema = z.record(z.string(), z.unknown());

// data-model.md #5. No id, no `archivedAt` and no concurrency token: the target
// is the identity, and the next keystrokes are meant to overwrite this.
export const draftSchema = draftTargetSchema
  .extend({
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    body: draftBodySchema,
  })
  .meta({ id: "Draft", title: "Draft" });

export const draftInputSchema = draftSchema
  .pick({ body: true })
  .meta({ id: "DraftInput", title: "Draft input" });

export type DraftTargetKind = z.infer<typeof draftTargetKindSchema>;
export type DraftTarget = z.infer<typeof draftTargetSchema>;
export type DraftBody = z.infer<typeof draftBodySchema>;
export type Draft = z.infer<typeof draftSchema>;
export type DraftInput = z.infer<typeof draftInputSchema>;
