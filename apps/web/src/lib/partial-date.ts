import { formatPartialDate as format } from "@keepcv/core";
import type { PartialDate } from "@keepcv/schema";

export const DATE_HINT = "A year, a month or a day: 2019, 2019-04 or 2019-04-01.";

// Not a template's locale: that is a per-resume option `compile()` takes.
const LOCALE = "en-GB";

export function formatPartialDate(value: PartialDate): string {
  return format(value, LOCALE);
}
