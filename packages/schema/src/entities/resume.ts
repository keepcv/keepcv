import { z } from "zod";
import { partialDateSchema } from "../primitives/partial-date.js";
import { sortKeySchema } from "../primitives/sort-key.js";
import { uuidSchema } from "../primitives/uuid.js";
import { standardFields } from "./standard-fields.js";

// The record kinds, with `custom_entry` reading as the heading rather than the
// row. A test feeds this and CAREER_RECORD_KINDS the same values.
export const SECTION_KINDS = [
  "experience",
  "education",
  "project",
  "skill",
  "certification",
  "publication",
  "award",
  "language",
  "volunteering",
  "speaking",
  "custom",
] as const;

export const sectionKindSchema = z.enum(SECTION_KINDS);

// A selection over the store, not a copy of it (data-model.md #9.1). No template
// and no current version yet: both arrive with the capabilities that own them.
export const resumeSchema = z
  .object({
    ...standardFields,
    name: z.string().min(1),
    targetCompany: z.string().nullable(),
    targetRole: z.string().nullable(),
    targetUrl: z.string().nullable(),
    targetJdText: z.string().nullable(),
    appliedOn: partialDateSchema.nullable(),
  })
  .meta({ id: "Resume", title: "Resume" });

export const resumeInputSchema = resumeSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const resumePatchSchema = resumeInputSchema.omit({ id: true }).partial();

// `resumeId` is carried on every level below so the parent reference can include
// it, which is what makes "this entry belongs to this resume" a foreign key
// rather than a check nobody runs (data-model.md I15, I13).
export const resumeSectionSchema = z
  .object({
    ...standardFields,
    resumeId: uuidSchema,
    kind: sectionKindSchema,
    customSectionId: uuidSchema.nullable(),
    heading: z.string().min(1).nullable(),
    layout: z.enum(["entries", "inline", "grouped"]).nullable(),
    sortKey: sortKeySchema,
    isVisible: z.boolean(),
  })
  .meta({ id: "ResumeSection", title: "Resume section" });

export const resumeSectionInputSchema = resumeSectionSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

// Not `kind` or `customSectionId`: a section's kind is what it selects, and
// changing it would leave every entry under it pointing at the wrong list.
export const resumeSectionPatchSchema = resumeSectionInputSchema
  .omit({ id: true, resumeId: true, kind: true, customSectionId: true })
  .partial();

export const resumeEntrySchema = z
  .object({
    ...standardFields,
    resumeId: uuidSchema,
    resumeSectionId: uuidSchema,
    recordId: uuidSchema,
    sortKey: sortKeySchema,
    isVisible: z.boolean(),
  })
  .meta({ id: "ResumeEntry", title: "Resume entry" });

export const resumeEntryInputSchema = resumeEntrySchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const resumeEntryPatchSchema = resumeEntryInputSchema
  .omit({ id: true, resumeId: true, resumeSectionId: true, recordId: true })
  .partial();

// `phrasingId` and not a revision id: while composing you want the live text, so
// an edit shows up immediately. A version pins the revision (data-model.md #9.1).
export const resumeEntryPointSchema = z
  .object({
    ...standardFields,
    resumeId: uuidSchema,
    resumeEntryId: uuidSchema,
    pointId: uuidSchema,
    phrasingId: uuidSchema,
    sortKey: sortKeySchema,
    isVisible: z.boolean(),
  })
  .meta({ id: "ResumeEntryPoint", title: "Resume entry point" });

export const resumeEntryPointInputSchema = resumeEntryPointSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const resumeEntryPointPatchSchema = resumeEntryPointInputSchema
  .omit({ id: true, resumeId: true, resumeEntryId: true, pointId: true })
  .partial();

// An override, so a channel with no row here uses its own `isDefaultVisible`.
// Rows for every channel would have to be written on create and kept in step
// with every channel added afterwards.
export const resumeContactChannelSchema = z
  .object({
    resumeId: uuidSchema,
    contactChannelId: uuidSchema,
    isVisible: z.boolean(),
  })
  .meta({ id: "ResumeContactChannel", title: "Resume contact channel" });

export type SectionKind = z.infer<typeof sectionKindSchema>;
export type Resume = z.infer<typeof resumeSchema>;
export type ResumeInput = z.infer<typeof resumeInputSchema>;
export type ResumePatch = z.infer<typeof resumePatchSchema>;
export type ResumeSection = z.infer<typeof resumeSectionSchema>;
export type ResumeSectionInput = z.infer<typeof resumeSectionInputSchema>;
export type ResumeSectionPatch = z.infer<typeof resumeSectionPatchSchema>;
export type ResumeEntry = z.infer<typeof resumeEntrySchema>;
export type ResumeEntryInput = z.infer<typeof resumeEntryInputSchema>;
export type ResumeEntryPatch = z.infer<typeof resumeEntryPatchSchema>;
export type ResumeEntryPoint = z.infer<typeof resumeEntryPointSchema>;
export type ResumeEntryPointInput = z.infer<typeof resumeEntryPointInputSchema>;
export type ResumeEntryPointPatch = z.infer<typeof resumeEntryPointPatchSchema>;
export type ResumeContactChannel = z.infer<typeof resumeContactChannelSchema>;
