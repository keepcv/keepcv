import { z } from "zod";

// SHA-256 over canonicalised JSON, lower-case hex (ADR-0008). Canonicalisation
// and hashing live in @keepcv/core; this is the shape alone.
export const contentHashSchema = z
  .string()
  .length(64)
  .regex(/^[0-9a-f]{64}$/, "expected a lower-case SHA-256 hex digest")
  .brand<"ContentHash">();

export type ContentHash = z.infer<typeof contentHashSchema>;
