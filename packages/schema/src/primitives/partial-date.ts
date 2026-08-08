import { z } from "zod";

// The `partial_date` domain in @keepcv/db interpolates this exact source, so
// the CHECK and the wire contract cannot drift (data-model.md §3.4).
export const PARTIAL_DATE_PATTERN = String.raw`^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$`;

// JavaScript's `$` also matches before a trailing newline; Postgres's `~` does
// not. Without the lookahead "2019\n" parses here and then fails the domain
// CHECK on insert.
const partialDate = new RegExp(`${PARTIAL_DATE_PATTERN}(?![\\s\\S])`);

export const partialDateSchema = z
  .string()
  .regex(partialDate, "expected YYYY, YYYY-MM or YYYY-MM-DD")
  .brand<"PartialDate">();

export type PartialDate = z.infer<typeof partialDateSchema>;
