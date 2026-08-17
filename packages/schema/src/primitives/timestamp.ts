import { z } from "zod";

// An absolute instant. A career date has no timezone: those are `partialDate`.
export const timestampSchema = z.iso.datetime({ offset: true }).brand<"Timestamp">();

export type Timestamp = z.infer<typeof timestampSchema>;
