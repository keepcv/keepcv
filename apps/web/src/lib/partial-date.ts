import type { PartialDate } from "@keepcv/schema";

export const DATE_HINT = "A year, a month or a day: 2019, 2019-04 or 2019-04-01.";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A real precision, not a full date with the tail unknown: rendering "2019" as
// "1 January 2019" invents a claim the user never made.
export function formatPartialDate(value: PartialDate): string {
  const [year, month, day] = value.split("-");
  if (year === undefined) return value;
  if (month === undefined) return year;
  const name = MONTHS[Number(month) - 1] ?? month;
  return day === undefined ? `${name} ${year}` : `${String(Number(day))} ${name} ${year}`;
}
