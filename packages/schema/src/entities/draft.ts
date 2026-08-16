import { z } from "zod";
import { timestampSchema } from "../primitives/timestamp.js";
import { uuidSchema } from "../primitives/uuid.js";

// Only the kinds that have a table to point at. A draft carries no foreign key -
// its target is polymorphic - so the store checks the target exists on every
// write, and a kind nothing can be checked against would be a dangling row by
// construction. `resume` joins this list in the migration that creates resumes.
export const DRAFT_TARGET_KINDS = ["phrasing", "record"] as const;

export const draftTargetKindSchema = z.enum(DRAFT_TARGET_KINDS);

// `field` is a path segment, so it may not carry a separator, and it is chosen
// by the editor rather than typed by anyone: a typo is a draft nothing reads.
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

// Whatever the editor holds, unvalidated. A draft is text on its way to being
// something, so checking it against the shape it will eventually commit to would
// reject exactly the half-written state this table exists to keep.
export const draftBodySchema = z.record(z.string(), z.unknown());

// Uncommitted editor state (data-model.md #5). No id: the target is the identity
// and there is no second draft of one field. No `archivedAt` and no
// `expectedUpdatedAt` either - a draft is overwritten by the next keystroke and
// discarded once its text is committed, so there is nothing for a token to
// protect. `updatedAt` says how old the unsaved text is, which is what the
// editor tells the user when it offers to restore it.
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
