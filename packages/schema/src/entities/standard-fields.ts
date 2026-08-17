import { timestampSchema } from "../primitives/timestamp.js";
import { uuidSchema } from "../primitives/uuid.js";

// data-model.md #3.1, minus `owner_id`: tenancy never reaches the wire or the
// export file, so a document carrying one would be a second source of truth.
export const standardFields = {
  id: uuidSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  archivedAt: timestampSchema.nullable(),
};
