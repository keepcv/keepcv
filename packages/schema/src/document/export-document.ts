import { z } from "zod";
import { careerRecordSchema } from "../entities/career-record.js";
import { contactChannelSchema } from "../entities/contact-channel.js";
import { organisationSchema } from "../entities/organisation.js";
import { profileSchema } from "../entities/profile.js";
import { recordFieldSchema } from "../entities/record-field.js";
import { recordLinkSchema } from "../entities/record-link.js";
import { timestampSchema } from "../primitives/timestamp.js";

export const CURRENT_SCHEMA_VERSION = 1;

// Every entity the store holds, archived rows included: `import(export(store))
// == store` is a tested property, so anything omitted here is data the format
// silently drops. Grows with each content slice - points, phrasings, resumes.
//
// Flat arrays rather than links and fields nested inside their records: the
// export is storage-shaped, and a shape that mirrors the rows is one that can be
// written back without deciding what belongs where.
export const storeSchema = z.object({
  profile: profileSchema,
  contactChannels: z.array(contactChannelSchema),
  organisations: z.array(organisationSchema),
  records: z.array(careerRecordSchema),
  recordLinks: z.array(recordLinkSchema),
  recordFields: z.array(recordFieldSchema),
});

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
