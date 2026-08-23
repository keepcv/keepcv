import { z } from "zod";
import { partialDateSchema } from "../primitives/partial-date.js";
import { sortKeySchema } from "../primitives/sort-key.js";
import { uuidSchema } from "../primitives/uuid.js";
import { standardFields } from "./standard-fields.js";

// The record kinds, with `custom_entry` reading as the heading it prints under.
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

export const SECTION_LAYOUTS = ["entries", "inline", "grouped"] as const;

export const sectionLayoutSchema = z.enum(SECTION_LAYOUTS);

// Defaulted on the row so an export written before the column existed still
// parses; named here so the patch schema can take the same type undefaulted.
const templateId = z.string().nullable();
const templateConfig = z.record(z.string(), z.unknown());
const pageLimit = z.number().int().positive().nullable();

export const resumeSchema = z
  .object({
    ...standardFields,
    name: z.string().min(1),
    targetCompany: z.string().nullable(),
    targetRole: z.string().nullable(),
    targetUrl: z.string().nullable(),
    targetJdText: z.string().nullable(),
    appliedOn: partialDateSchema.nullable(),
    templateId: templateId.default(null),
    templateConfig: templateConfig.default({}),
    pageLimit: pageLimit.default(null),
  })
  .meta({ id: "Resume", title: "Resume" });

export const resumeInputSchema = resumeSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

// `.partial()` leaves a `.default()` in place, so an absent key would still
// parse to the default and renaming a resume would reset its template.
export const resumePatchSchema = resumeInputSchema
  .omit({ id: true })
  .extend({ templateId, templateConfig, pageLimit })
  .partial();

// `resumeId` is on every level below, not reached through the parent.
export const resumeSectionSchema = z
  .object({
    ...standardFields,
    resumeId: uuidSchema,
    kind: sectionKindSchema,
    customSectionId: uuidSchema.nullable(),
    heading: z.string().min(1).nullable(),
    layout: sectionLayoutSchema.nullable(),
    sortKey: sortKeySchema,
    isVisible: z.boolean(),
  })
  .meta({ id: "ResumeSection", title: "Resume section" });

export const resumeSectionInputSchema = resumeSectionSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

// No `kind`: changing it leaves every entry under it selecting the wrong list.
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

// `phrasingId` and not a revision id.
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

// An override: a channel with no row here uses its own `isDefaultVisible`.
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
