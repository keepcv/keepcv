import type { Timestamp } from "@keepcv/schema";

// Not a partial date: a moment the store recorded is never printed on a resume,
// so it has its own contract and its own format.
const MOMENT = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export function formatTimestamp(at: Timestamp): string {
  return MOMENT.format(new Date(at));
}
