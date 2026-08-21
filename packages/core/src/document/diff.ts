import type {
  ChangeKind,
  EntryChange,
  FieldChange,
  ManifestDiff,
  ManifestEntry,
  ManifestPoint,
  ManifestSection,
  PhrasingRevision,
  PointChange,
  ResumeManifest,
  SectionChange,
  Uuid,
} from "@keepcv/schema";
import { projectPlainText } from "../richtext/plain-text.js";
import { formatMetric } from "./format.js";

type Texts = Map<Uuid, string>;

type Reader<T> = (row: T) => string | null;

interface Matched<T> {
  key: string;
  row: T;
  a: T | undefined;
  b: T | undefined;
  aIndex: number | null;
  bIndex: number | null;
}

function scalar(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function joined(values: readonly string[]): string | null {
  return values.length === 0 ? null : values.join(", ");
}

function wording(texts: Texts, id: Uuid | null): string | null {
  return id === null ? null : (texts.get(id) ?? null);
}

function fieldsOf<T>(
  a: T | undefined,
  b: T | undefined,
  readers: Record<string, Reader<T>>,
): FieldChange[] {
  return Object.entries(readers).flatMap(([field, read]) => {
    const left = a === undefined ? null : read(a);
    const right = b === undefined ? null : read(b);
    return left === right ? [] : [{ field, a: left, b: right }];
  });
}

// Keyed by what makes the row that row, with the occurrence appended: one record
// placed twice under a heading is two rows, not one row seen twice.
function align<T>(as: readonly T[], bs: readonly T[], keyOf: (row: T) => string): Matched<T>[] {
  const indexed = (rows: readonly T[]) => {
    const seen = new Map<string, number>();
    const keyed = new Map<string, { row: T; at: number }>();
    for (const [at, row] of rows.entries()) {
      const base = keyOf(row);
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      keyed.set(count === 1 ? base : `${base}#${String(count)}`, { row, at });
    }
    return keyed;
  };

  const aRows = indexed(as);
  const bRows = indexed(bs);
  const keys = [...bRows.keys(), ...[...aRows.keys()].filter((key) => !bRows.has(key))];

  return keys.flatMap((key) => {
    const a = aRows.get(key);
    const b = bRows.get(key);
    const found = b ?? a;
    if (found === undefined) return [];
    return [
      { key, row: found.row, a: a?.row, b: b?.row, aIndex: a?.at ?? null, bIndex: b?.at ?? null },
    ];
  });
}

// Only rows on both sides can move, and only relative to each other: measured by
// raw index, inserting one at the top would report every row below it as moved.
function movedKeys<T>(rows: readonly Matched<T>[]): Set<string> {
  const common = rows.filter((row) => row.aIndex !== null && row.bIndex !== null);
  const inA = [...common].sort((x, y) => (x.aIndex ?? 0) - (y.aIndex ?? 0));
  const inB = [...common].sort((x, y) => (x.bIndex ?? 0) - (y.bIndex ?? 0));
  return new Set(inA.flatMap((row, at) => (inB[at]?.key === row.key ? [] : [row.key])));
}

function changeOf<T>(row: Matched<T>, moved: Set<string>, differs: boolean): ChangeKind | null {
  if (row.a === undefined) return "added";
  if (row.b === undefined) return "removed";
  if (differs) return "changed";
  return moved.has(row.key) ? "moved" : null;
}

function pointReaders(texts: Texts): Record<string, Reader<ManifestPoint>> {
  return {
    wording: (row) => wording(texts, row.phrasingRevisionId),
    metrics: (row) =>
      joined(
        row.metrics.map((metric, at) => {
          const shown = formatMetric(metric, String(at));
          return `${shown.label} ${shown.display}`;
        }),
      ),
    tags: (row) => joined(row.tags),
  };
}

function diffPoints(
  texts: Texts,
  a: readonly ManifestPoint[],
  b: readonly ManifestPoint[],
): PointChange[] {
  const rows = align(a, b, (row) => row.pointId);
  const moved = movedKeys(rows);
  const readers = pointReaders(texts);

  return rows.flatMap((row) => {
    const fields = fieldsOf(row.a, row.b, readers);
    const change = changeOf(row, moved, fields.length > 0);
    if (change === null) return [];
    return [
      {
        pointId: row.row.pointId,
        text: wording(texts, row.row.phrasingRevisionId),
        change,
        aIndex: row.aIndex,
        bIndex: row.bIndex,
        fields,
      },
    ];
  });
}

// The standard columns and the two foreign keys the readers below resolve by
// name: a diff reporting that `updated_at` moved is a diff nobody finishes
// reading.
const RECORD_ASIDES = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "archivedAt",
  "sortKey",
  "kind",
  "organisationId",
  "summarySetId",
]);

// Every remaining column of whichever kind the record is, so a column added to a
// kind is diffed without anyone extending a second vocabulary.
function entryReaders(
  texts: Texts,
  a: ManifestEntry | undefined,
  b: ManifestEntry | undefined,
): Record<string, Reader<ManifestEntry>> {
  const columns = [...new Set([...Object.keys(a?.record ?? {}), ...Object.keys(b?.record ?? {})])]
    .filter((key) => !RECORD_ASIDES.has(key))
    .map((key): [string, Reader<ManifestEntry>] => [
      key,
      (row) => scalar((row.record as unknown as Record<string, unknown>)[key]),
    ]);

  return {
    ...Object.fromEntries(columns),
    organisation: (row) => row.organisation?.name ?? null,
    summary: (row) => wording(texts, row.summaryRevisionId),
    links: (row) => joined(row.links.map((link) => link.url)),
    fields: (row) => joined(row.fields.map((field) => `${field.label}: ${field.value}`)),
    tags: (row) => joined(row.tags),
  };
}

function diffEntries(
  texts: Texts,
  a: readonly ManifestEntry[],
  b: readonly ManifestEntry[],
): EntryChange[] {
  const rows = align(a, b, (row) => row.record.id);
  const moved = movedKeys(rows);

  return rows.flatMap((row) => {
    const fields = fieldsOf(row.a, row.b, entryReaders(texts, row.a, row.b));
    const points = diffPoints(texts, row.a?.points ?? [], row.b?.points ?? []);
    const change = changeOf(row, moved, fields.length > 0 || points.length > 0);
    if (change === null) return [];
    return [
      {
        recordId: row.row.record.id,
        title: row.row.record.title,
        change,
        aIndex: row.aIndex,
        bIndex: row.bIndex,
        fields,
        points,
      },
    ];
  });
}

const SECTION_READERS: Record<string, Reader<ManifestSection>> = {
  layout: (row) => row.layout,
};

function diffSections(
  texts: Texts,
  a: readonly ManifestSection[],
  b: readonly ManifestSection[],
): SectionChange[] {
  const rows = align(a, b, (row) => `${row.kind}:${row.heading}`);
  const moved = movedKeys(rows);

  return rows.flatMap((row) => {
    const fields = fieldsOf(row.a, row.b, SECTION_READERS);
    const entries = diffEntries(texts, row.a?.entries ?? [], row.b?.entries ?? []);
    const change = changeOf(row, moved, fields.length > 0 || entries.length > 0);
    if (change === null) return [];
    return [
      {
        kind: row.row.kind,
        heading: row.row.heading,
        change,
        aIndex: row.aIndex,
        bIndex: row.bIndex,
        fields,
        entries,
      },
    ];
  });
}

const TARGET_READERS: Record<string, Reader<ResumeManifest>> = {
  name: (row) => row.resume.name,
  targetCompany: (row) => row.resume.targetCompany,
  targetRole: (row) => row.resume.targetRole,
  targetUrl: (row) => row.resume.targetUrl,
  appliedOn: (row) => row.resume.appliedOn,
};

function profileReaders(texts: Texts): Record<string, Reader<ResumeManifest>> {
  return {
    fullName: (row) => row.profile.fullName,
    headline: (row) => row.profile.headline,
    pronouns: (row) => row.profile.pronouns,
    location: (row) => row.profile.location,
    summary: (row) => wording(texts, row.profile.summaryRevisionId),
    contacts: (row) => joined(row.profile.contacts.map((contact) => contact.value)),
  };
}

// What two versions of one resume say differently. The revisions come in for the
// reason `renderManifest` takes them: a manifest pins text by id, and a diff a
// reader has to resolve by hand has not answered the question.
export function diffManifests(
  a: ResumeManifest,
  b: ResumeManifest,
  revisions: readonly PhrasingRevision[],
): ManifestDiff {
  const texts: Texts = new Map(revisions.map((row) => [row.id, projectPlainText(row.body)]));

  return {
    target: fieldsOf(a, b, TARGET_READERS),
    profile: fieldsOf(a, b, profileReaders(texts)),
    sections: diffSections(texts, a.sections, b.sections),
  };
}
