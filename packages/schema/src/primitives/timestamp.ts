import { z } from "zod";

// An absolute instant, offset always present. Civil dates are `partialDate` —
// a career date has no timezone and must never become one (data-model.md §3.4).
export const timestampSchema = z.iso.datetime({ offset: true }).brand<"Timestamp">();

export type Timestamp = z.infer<typeof timestampSchema>;
