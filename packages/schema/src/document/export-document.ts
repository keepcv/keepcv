import { z } from "zod";
import { careerRecordSchema } from "../entities/career-record.js";
import { contactChannelSchema } from "../entities/contact-channel.js";
import { customSectionSchema } from "../entities/custom-section.js";
import { evidenceSchema } from "../entities/evidence.js";
import { metricSchema } from "../entities/metric.js";
import { organisationSchema } from "../entities/organisation.js";
import { phrasingRevisionSchema, phrasingSchema, phrasingSetSchema } from "../entities/phrasing.js";
import { pointRecordLinkSchema, pointSchema } from "../entities/point.js";
import { profileSchema } from "../entities/profile.js";
import { recordFieldSchema } from "../entities/record-field.js";
import { recordLinkSchema } from "../entities/record-link.js";
import { pointTagSchema, recordTagSchema, tagSchema } from "../entities/tag.js";
import { timestampSchema } from "../primitives/timestamp.js";

export const CURRENT_SCHEMA_VERSION = 1;

// Every entity the store holds, archived rows included: `import(export(store))
// == store` is a tested property, so anything omitted here is data the format
// silently drops. Grows with each content slice - resumes, versions.
//
// Flat arrays rather than links and fields nested inside their records: the
// export is storage-shaped, and a shape that mirrors the rows is one that can be
// written back without deciding what belongs where.
export const storeSchema = z
  .object({
    profile: profileSchema,
    contactChannels: z.array(contactChannelSchema),
    organisations: z.array(organisationSchema),
    customSections: z.array(customSectionSchema),
    records: z.array(careerRecordSchema),
    recordLinks: z.array(recordLinkSchema),
    recordFields: z.array(recordFieldSchema),
    phrasingSets: z.array(phrasingSetSchema),
    phrasings: z.array(phrasingSchema),
    phrasingRevisions: z.array(phrasingRevisionSchema),
    points: z.array(pointSchema),
    pointRecordLinks: z.array(pointRecordLinkSchema),
    metrics: z.array(metricSchema),
    // Private, and exported anyway: never printed is not the same as withheld
    // from the user, and an export that dropped it would not round-trip.
    evidence: z.array(evidenceSchema),
    tags: z.array(tagSchema),
    recordTags: z.array(recordTagSchema),
    pointTags: z.array(pointTagSchema),
  })
  // Named, because two routes answer this shape and an anonymous one would be
  // inlined into the OpenAPI document twice.
  .meta({ id: "Store", title: "Career store" });

// The canonical, lossless career store format - not a resume. `schemaVersion`
// is pinned to the current one because `migrateDocument` is the only supported
// way in, and it brings older documents forward first.
export const exportDocumentSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    exportedAt: timestampSchema,
    store: storeSchema,
  })
  .meta({
    id: "KeepCVExport",
    title: "KeepCV export document",
    description:
      "The canonical, lossless export of a KeepCV career store. Import runs forward migrations, so a document exported under an older schemaVersion still loads.",
  });

export type Store = z.infer<typeof storeSchema>;
export type ExportDocument = z.infer<typeof exportDocumentSchema>;
