import { z } from "zod";
import { contactChannelKindSchema } from "../entities/contact-channel.js";
import { recordFieldValueKindSchema } from "../entities/record-field.js";
import { sectionKindSchema, sectionLayoutSchema } from "../entities/resume.js";
import { templateSpecSchema } from "../entities/template.js";
import { richTextSchema } from "../primitives/rich-text.js";

export const RESUME_DOCUMENT_SCHEMA_VERSION = 1;

// Positional, so nothing here is a store identifier.
const keySchema = z.string().min(1);

export const documentPeriodSchema = z
  .object({
    start: z.string().optional(),
    end: z.string().optional(),
    isCurrent: z.boolean(),
    display: z.string(),
  })
  .meta({ id: "DocumentPeriod", title: "Period" });

export const documentContactSchema = z
  .object({
    key: keySchema,
    kind: contactChannelKindSchema,
    label: z.string().optional(),
    value: z.string(),
    href: z.string().optional(),
  })
  .meta({ id: "DocumentContact", title: "Contact" });

export const documentLinkSchema = z
  .object({ key: keySchema, kind: z.string(), label: z.string(), url: z.string() })
  .meta({ id: "DocumentLink", title: "Link" });

export const documentFieldSchema = z
  .object({
    key: keySchema,
    label: z.string(),
    value: z.string(),
    kind: recordFieldValueKindSchema,
  })
  .meta({ id: "DocumentField", title: "Field" });

export const documentOrganisationSchema = z
  .object({ name: z.string(), url: z.string().optional(), location: z.string().optional() })
  .meta({ id: "DocumentOrganisation", title: "Organisation" });

export const documentMetricSchema = z
  .object({
    key: keySchema,
    label: z.string(),
    display: z.string(),
    value: z.number(),
    unit: z.string().optional(),
    baseline: z.number().optional(),
    direction: z.enum(["increase", "decrease", "neutral"]).optional(),
  })
  .meta({ id: "DocumentMetric", title: "Metric" });

export const documentPointSchema = z
  .object({
    key: keySchema,
    text: richTextSchema,
    plainText: z.string(),
    metrics: z.array(documentMetricSchema),
    tags: z.array(z.string()),
  })
  .meta({ id: "DocumentPoint", title: "Point" });

export const documentEntrySchema = z
  .object({
    key: keySchema,
    kind: z.string(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    organisation: documentOrganisationSchema.optional(),
    period: documentPeriodSchema.optional(),
    location: z.string().optional(),
    mode: z.string().optional(),
    summary: richTextSchema.optional(),
    points: z.array(documentPointSchema),
    tags: z.array(z.string()),
    links: z.array(documentLinkSchema),
    fields: z.array(documentFieldSchema),
  })
  .meta({ id: "DocumentEntry", title: "Entry" });

export const documentGroupSchema = z
  .object({
    key: keySchema,
    title: z.string(),
    subtitle: z.string().optional(),
    period: documentPeriodSchema.optional(),
    entryKeys: z.array(keySchema),
  })
  .meta({ id: "DocumentGroup", title: "Group" });

// Groups reference entries by key rather than nesting them, so a template that
// ignores the layout hint still renders every entry exactly once.
export const documentSectionSchema = z
  .object({
    key: keySchema,
    kind: sectionKindSchema,
    heading: z.string(),
    layout: sectionLayoutSchema,
    groups: z.array(documentGroupSchema).optional(),
    entries: z.array(documentEntrySchema),
  })
  .meta({ id: "DocumentSection", title: "Section" });

export const documentHeaderSchema = z
  .object({
    fullName: z.string().optional(),
    headline: z.string().optional(),
    pronouns: z.string().optional(),
    location: z.string().optional(),
    summary: richTextSchema.optional(),
    contacts: z.array(documentContactSchema),
  })
  .meta({ id: "DocumentHeader", title: "Header" });

export const documentMetaSchema = z
  .object({
    generatedAt: z.string(),
    resumeName: z.string(),
    locale: z.string(),
    templateId: z.string().optional(),
    templateName: z.string().optional(),
    templateConfig: z.record(z.string(), z.unknown()).optional(),
    // A template the user wrote is editable, so a document that only named one
    // would re-render once it was edited and a version would stop saying what
    // was sent. Built-in templates are resolved by id and carry nothing here.
    templateSpec: templateSpecSchema.optional(),
  })
  .meta({ id: "DocumentMeta", title: "Document metadata" });

// The one shape that crosses every layer unchanged. It has no field evidence
// could travel in, which is invariant I5.
export const resumeDocumentSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    meta: documentMetaSchema,
    header: documentHeaderSchema,
    sections: z.array(documentSectionSchema),
  })
  .meta({ id: "ResumeDocument", title: "Resume document" });

export type DocumentPeriod = z.infer<typeof documentPeriodSchema>;
export type DocumentContact = z.infer<typeof documentContactSchema>;
export type DocumentLink = z.infer<typeof documentLinkSchema>;
export type DocumentField = z.infer<typeof documentFieldSchema>;
export type DocumentOrganisation = z.infer<typeof documentOrganisationSchema>;
export type DocumentMetric = z.infer<typeof documentMetricSchema>;
export type DocumentPoint = z.infer<typeof documentPointSchema>;
export type DocumentEntry = z.infer<typeof documentEntrySchema>;
export type DocumentGroup = z.infer<typeof documentGroupSchema>;
export type DocumentSection = z.infer<typeof documentSectionSchema>;
export type DocumentHeader = z.infer<typeof documentHeaderSchema>;
export type DocumentMeta = z.infer<typeof documentMetaSchema>;
export type ResumeDocument = z.infer<typeof resumeDocumentSchema>;
