import { z } from "zod";

// The `partial_date` domain in @keepcv/db repeats this source, and a test there
// feeds both the same values so the CHECK and the wire contract cannot drift.
export const PARTIAL_DATE_PATTERN = String.raw`^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$`;

// JavaScript's `$` matches before a trailing newline and Postgres's `~` does
// not, so without the lookahead "2019\n" parses here and fails the CHECK.
const partialDate = new RegExp(`${PARTIAL_DATE_PATTERN}(?![\\s\\S])`);

export const partialDateSchema = z
  .string()
  .regex(partialDate, "expected YYYY, YYYY-MM or YYYY-MM-DD")
  .brand<"PartialDate">();

export type PartialDate = z.infer<typeof partialDateSchema>;
