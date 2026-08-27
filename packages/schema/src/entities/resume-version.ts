import { z } from "zod";
import { contentHashSchema } from "../primitives/content-hash.js";
import { partialDateSchema } from "../primitives/partial-date.js";
import { timestampSchema } from "../primitives/timestamp.js";
import { uuidSchema } from "../primitives/uuid.js";
import { careerRecordSchema } from "./career-record.js";
import { contactChannelSchema } from "./contact-channel.js";
import { metricSchema } from "./metric.js";
import { organisationSchema } from "./organisation.js";
import { recordFieldSchema } from "./record-field.js";
import { recordLinkSchema } from "./record-link.js";
import { sectionKindSchema, sectionLayoutSchema } from "./resume.js";
import { standardFields } from "./standard-fields.js";
import { templateSpecSchema } from "./template.js";

export const MANIFEST_SCHEMA_VERSION = 1;

// Whole rows as they were, in the order they printed, so no sort key: the array
// is the ordering.
export const manifestPointSchema = z
  .object({
    pointId: uuidSchema,
    phrasingRevisionId: uuidSchema,
    metrics: z.array(metricSchema),
    tags: z.array(z.string()),
  })
  .meta({ id: "ManifestPoint", title: "Pinned point" });

export const manifestEntrySchema = z
  .object({
    record: careerRecordSchema,
    organisation: organisationSchema.nullable(),
    summaryRevisionId: uuidSchema.nullable(),
    links: z.array(recordLinkSchema),
    fields: z.array(recordFieldSchema),
    tags: z.array(z.string()),
    points: z.array(manifestPointSchema),
  })
  .meta({ id: "ManifestEntry", title: "Pinned entry" });

// The heading is resolved here, so renaming a custom section later cannot
// rewrite what a version says was printed.
export const manifestSectionSchema = z
  .object({
    kind: sectionKindSchema,
    heading: z.string(),
    layout: sectionLayoutSchema,
    entries: z.array(manifestEntrySchema),
  })
  .meta({ id: "ManifestSection", title: "Pinned section" });

export const manifestProfileSchema = z
  .object({
    fullName: z.string().nullable(),
    headline: z.string().nullable(),
    pronouns: z.string().nullable(),
    location: z.string().nullable(),
    summaryRevisionId: uuidSchema.nullable(),
    contacts: z.array(contactChannelSchema),
  })
  .meta({ id: "ManifestProfile", title: "Pinned profile" });

// No `targetJdText`: it is what the resume was composed against, not part of
// what was sent, and it would multiply the size of every version.
export const manifestTargetSchema = z
  .object({
    name: z.string(),
    targetCompany: z.string().nullable(),
    targetRole: z.string().nullable(),
    targetUrl: z.string().nullable(),
    appliedOn: partialDateSchema.nullable(),
  })
  .meta({ id: "ManifestTarget", title: "Pinned target context" });

// Pinned like everything else a version claims: a template swapped in June must
// not change how a March version prints.
export const manifestTemplateSchema = z
  .object({
    id: z.string().nullable(),
    name: z.string().nullable().default(null),
    config: z.record(z.string(), z.unknown()),
    // The whole design, for a template the user wrote: an id alone points at a
    // row they can edit, and editing it would rewrite what this version says.
    spec: templateSpecSchema.nullable().default(null),
  })
  .meta({ id: "ManifestTemplate", title: "Pinned template" });

export const resumeManifestSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    resume: manifestTargetSchema,
    template: manifestTemplateSchema.default({ id: null, name: null, config: {}, spec: null }),
    profile: manifestProfileSchema,
    sections: z.array(manifestSectionSchema),
  })
  .meta({ id: "ResumeManifest", title: "Resume manifest" });

export const VERSION_TRIGGERS = ["export", "manual_save", "restore"] as const;

export const versionTriggerSchema = z.enum(VERSION_TRIGGERS);

// Immutable, so no `updatedAt` and no `archivedAt`.
export const resumeVersionSchema = z
  .object({
    id: uuidSchema,
    createdAt: timestampSchema,
    resumeId: uuidSchema,
    seq: z.int().positive(),
    trigger: versionTriggerSchema,
    restoredFromVersionId: uuidSchema.nullable(),
    manifest: resumeManifestSchema,
    manifestHash: contentHashSchema,
  })
  .meta({ id: "ResumeVersion", title: "Resume version" });

// `seq` and `manifestHash` are assigned by the store: one is a count it holds
// and the other is derived from the manifest.
export const resumeVersionInputSchema = resumeVersionSchema.omit({
  createdAt: true,
  seq: true,
  manifestHash: true,
});

export const resumeSnapshotSchema = z
  .object({
    ...standardFields,
    resumeVersionId: uuidSchema,
    label: z.string().min(1),
    note: z.string().nullable(),
    starredAt: timestampSchema,
  })
  .meta({ id: "ResumeSnapshot", title: "Resume snapshot" });

export const resumeSnapshotInputSchema = resumeSnapshotSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  starredAt: true,
});

export const resumeSnapshotPatchSchema = resumeSnapshotInputSchema
  .omit({ id: true, resumeVersionId: true })
  .partial();

export const RESTORE_SUBJECTS = ["section", "entry", "point"] as const;

export const restoreSubjectSchema = z.enum(RESTORE_SUBJECTS);

// A restore places what it can and says what it could not, rather than refusing
// whole: a manifest names rows by id, and the store may no longer hold one.
export const restoreOmissionSchema = z
  .object({
    subject: restoreSubjectSchema,
    reference: z.string(),
  })
  .meta({ id: "RestoreOmission", title: "Omitted on restore" });

export const restoredResumeSchema = z
  .object({
    version: resumeVersionSchema,
    omissions: z.array(restoreOmissionSchema),
  })
  .meta({ id: "RestoredResume", title: "Restored resume" });

export const CONTENT_REF_KINDS = [
  "record",
  "point",
  "phrasing_revision",
  "contact_channel",
] as const;

export const contentRefKindSchema = z.enum(CONTENT_REF_KINDS);

// Which versions a row is printed in. Derived from manifests and rebuilt on
// import, so it can never be the cause of a correctness bug.
export const versionRefSchema = z
  .object({
    resumeVersionId: uuidSchema,
    resumeId: uuidSchema,
    seq: z.int().positive(),
    createdAt: timestampSchema,
  })
  .meta({ id: "VersionRef", title: "Version reference" });

export type ManifestPoint = z.infer<typeof manifestPointSchema>;
export type ManifestEntry = z.infer<typeof manifestEntrySchema>;
export type ManifestSection = z.infer<typeof manifestSectionSchema>;
export type ManifestProfile = z.infer<typeof manifestProfileSchema>;
export type ManifestTarget = z.infer<typeof manifestTargetSchema>;
export type ManifestTemplate = z.infer<typeof manifestTemplateSchema>;
export type ResumeManifest = z.infer<typeof resumeManifestSchema>;
export type VersionTrigger = z.infer<typeof versionTriggerSchema>;
export type ResumeVersion = z.infer<typeof resumeVersionSchema>;
export type ResumeVersionInput = z.infer<typeof resumeVersionInputSchema>;
export type ResumeSnapshot = z.infer<typeof resumeSnapshotSchema>;
export type ResumeSnapshotInput = z.infer<typeof resumeSnapshotInputSchema>;
export type ResumeSnapshotPatch = z.infer<typeof resumeSnapshotPatchSchema>;
export type ContentRefKind = z.infer<typeof contentRefKindSchema>;
export type VersionRef = z.infer<typeof versionRefSchema>;
export type RestoreSubject = z.infer<typeof restoreSubjectSchema>;
export type RestoreOmission = z.infer<typeof restoreOmissionSchema>;
export type RestoredResume = z.infer<typeof restoredResumeSchema>;
