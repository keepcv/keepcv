import { z } from "zod";

// Must stay in ASCII order: `ORDER BY sort_key` in Postgres has to agree with
// the digit arithmetic in @keepcv/core.
export const SORT_KEY_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// The lexical contract only (data-model.md §3.5). Structural rules — the
// magnitude prefix, the trailing-digit restriction — belong to the generation
// algorithm in @keepcv/core, so storage need not move in lockstep with it.
export const sortKeySchema = z
  .string()
  .min(1, "a sort key must not be empty")
  .regex(/^[0-9A-Za-z]+$/, "a sort key must contain only base-62 digits")
  .brand<"SortKey">();

export type SortKey = z.infer<typeof sortKeySchema>;
