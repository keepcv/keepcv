import { z } from "zod";
import { timestampSchema } from "../primitives/timestamp.js";

export const CURRENT_SCHEMA_VERSION = 1;

// The seam every content slice writes into: F1 adds the profile, F2 the record
// store, F4 points and phrasings. Empty today because no entity is modelled yet.
export const storeSchema = z.object({});

// The canonical, lossless career store format — not a resume. `schemaVersion`
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

export type ExportDocument = z.infer<typeof exportDocumentSchema>;
