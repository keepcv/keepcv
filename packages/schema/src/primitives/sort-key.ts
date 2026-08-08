import { z } from "zod";

/**
 * Base-62 digits in ASCII order, so lexicographic string comparison and
 * numeric digit comparison agree. This is what lets the database sort by
 * `sort_key` with a plain `ORDER BY` and get the same order the application
 * computed.
 */
export const SORT_KEY_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * A fractional index (data-model.md §3.5).
 *
 * Ordering is user-controlled by drag-and-drop, so a move must write exactly
 * one row; integer positions would require renumbering everything after the
 * insertion point.
 *
 * This schema defines the **lexical** contract only: what storage accepts and
 * what crosses the wire. The structural rules — how the magnitude prefix
 * encodes the integer part, and why a fractional part may not end in the
 * smallest digit — belong to the generation algorithm and are enforced in
 * `@keepcv/core`. Keeping them apart means storage does not have to be
 * upgraded in lockstep with the algorithm.
 */
export const sortKeySchema = z
  .string()
  .min(1, "a sort key must not be empty")
  .regex(/^[0-9A-Za-z]+$/, "a sort key must contain only base-62 digits")
  .brand<"SortKey">();

export type SortKey = z.infer<typeof sortKeySchema>;
