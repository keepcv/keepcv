import { timestampSchema } from "../primitives/timestamp.js";
import { uuidSchema } from "../primitives/uuid.js";

// The columns every domain table carries (data-model.md #3.1), minus `owner_id`.
// Tenancy never reaches the wire or the export file: repositories read the owner
// from ambient scope, so a document carrying one would be a second, disagreeing
// source of truth for who a row belongs to.
export const standardFields = {
  id: uuidSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  archivedAt: timestampSchema.nullable(),
};
