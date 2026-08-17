import type { ContactChannelKind, DocumentMetric, DocumentPeriod, Metric } from "@keepcv/schema";

const MONTHS = 12;

// A partial date is "2026", "2026-03" or "2026-03-14" (data-model.md #3.4).
export function formatPartialDate(value: string, locale: string): string {
  const [year, month, day] = value.split("-");
  if (year === undefined) return value;
  if (month === undefined) return year;

  const index = Number(month) - 1;
  if (index < 0 || index >= MONTHS) return value;
  const at = new Date(Date.UTC(Number(year), index, day === undefined ? 1 : Number(day)));
  const options: Intl.DateTimeFormatOptions =
    day === undefined
      ? { month: "short", year: "numeric", timeZone: "UTC" }
      : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat(locale, options).format(at);
}

export function formatPeriod(
  start: string | null,
  end: string | null,
  isCurrent: boolean,
  locale: string,
): DocumentPeriod | undefined {
  if (start === null && end === null && !isCurrent) return undefined;

  const from = start === null ? undefined : formatPartialDate(start, locale);
  const to = isCurrent ? "Present" : end === null ? undefined : formatPartialDate(end, locale);
  const display = from === undefined ? (to ?? "") : to === undefined ? from : `${from} - ${to}`;

  return {
    ...(start === null ? {} : { start }),
    ...(end === null ? {} : { end }),
    isCurrent,
    display,
  };
}

function withUnit(value: number, unit: string | null): string {
  return unit === null ? String(value) : `${value}${unit}`;
}

export function formatMetric(metric: Metric, key: string): DocumentMetric {
  const measured = withUnit(metric.value, metric.unit);
  return {
    key,
    label: metric.label,
    display:
      metric.baseline === null
        ? measured
        : `${withUnit(metric.baseline, metric.unit)} -> ${measured}`,
    value: metric.value,
    ...(metric.unit === null ? {} : { unit: metric.unit }),
    ...(metric.baseline === null ? {} : { baseline: metric.baseline }),
    ...(metric.direction === null ? {} : { direction: metric.direction }),
  };
}

const SCHEMES: Partial<Record<ContactChannelKind, string>> = { email: "mailto:", phone: "tel:" };

// Absent when the value is not something a page can link to.
export function contactHref(kind: ContactChannelKind, value: string): string | undefined {
  const scheme = SCHEMES[kind];
  if (scheme !== undefined) return `${scheme}${value.replace(/\s+/g, "")}`;
  if (kind === "location" || kind === "other") return undefined;
  return /^https?:\/\//.test(value) ? value : `https://${value}`;
}
