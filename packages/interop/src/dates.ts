import type { PartialDate } from "@keepcv/schema";
import { partialDateSchema } from "@keepcv/schema";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const ONGOING = /^(present|current|now|to date|ongoing)$/i;

// Every dash a template might set between two dates, plus the word.
const RANGE = /\s*(?:-|\u2013|\u2014|to|until)\s+/i;

const partial = (value: string): PartialDate | null => {
  const parsed = partialDateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

// "March 2019", "Mar 2019", "03/2019", "2019-03", "2019". Anything else is not
// a date, which is the answer that keeps a job title out of a period.
export function readDate(text: string): PartialDate | null {
  const trimmed = text.trim().replace(/,/g, "");
  if (trimmed === "") return null;

  const named = /^([a-z]{3,9})\.?\s+(\d{4})$/i.exec(trimmed);
  if (named !== null) {
    const month = MONTHS.indexOf((named[1] ?? "").slice(0, 3).toLowerCase());
    if (month >= 0) return partial(`${named[2] ?? ""}-${String(month + 1).padStart(2, "0")}`);
    return null;
  }

  const slashed = /^(\d{1,2})[/.](\d{4})$/.exec(trimmed);
  if (slashed !== null) {
    return partial(`${slashed[2] ?? ""}-${(slashed[1] ?? "").padStart(2, "0")}`);
  }

  const iso = /^(\d{4})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?$/.exec(trimmed);
  if (iso !== null) {
    const parts = [iso[1] ?? ""];
    if (iso[2] !== undefined) parts.push(iso[2].padStart(2, "0"));
    if (iso[3] !== undefined) parts.push(iso[3].padStart(2, "0"));
    return partial(parts.join("-"));
  }

  return null;
}

export interface ReadPeriod {
  startedOn: PartialDate | null;
  endedOn: PartialDate | null;
  isCurrent: boolean;
}

// Answers undefined when the text is not a period at all, so a caller can tell
// "no dates here" from "a period that starts nowhere".
export function readPeriod(text: string): ReadPeriod | undefined {
  const parts = text.trim().split(RANGE);
  if (parts.length > 2) return undefined;

  const [from, to] = parts;
  const startedOn = readDate(from ?? "");
  if (startedOn === null) return undefined;
  if (to === undefined) return { startedOn, endedOn: null, isCurrent: false };

  if (ONGOING.test(to.trim())) return { startedOn, endedOn: null, isCurrent: true };
  const endedOn = readDate(to);
  return endedOn === null ? undefined : { startedOn, endedOn, isCurrent: false };
}
