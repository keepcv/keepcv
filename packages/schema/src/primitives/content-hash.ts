import { z } from "zod";

// The shape alone: canonicalisation and hashing live in @keepcv/core.
export const contentHashSchema = z
  .string()
  .length(64)
  .regex(/^[0-9a-f]{64}$/, "expected a lower-case SHA-256 hex digest")
  .brand<"ContentHash">();

export type ContentHash = z.infer<typeof contentHashSchema>;
