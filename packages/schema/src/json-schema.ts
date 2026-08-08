import { z } from "zod";
import { CURRENT_SCHEMA_VERSION, exportDocumentSchema } from "./document/export-document.js";

// Published so third parties can validate a KeepCV export without running
// KeepCV. `pnpm --filter @keepcv/schema schema:emit` writes it to schema/, and
// a test fails when the committed copy drifts from this.
export const EXPORT_JSON_SCHEMA_FILE = `keepcv-v${CURRENT_SCHEMA_VERSION}.schema.json`;

export const exportJsonSchema = z.toJSONSchema(exportDocumentSchema, {
  target: "draft-2020-12",
});
