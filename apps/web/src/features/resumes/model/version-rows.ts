import type {
  ChangeKind,
  EntryChange,
  FieldChange,
  ManifestDiff,
  PointChange,
  ResumeVersion,
  Uuid,
  VersionTrigger,
} from "@keepcv/schema";
import { formatTimestamp } from "../../../lib/timestamp.js";

export interface VersionRow {
  id: Uuid;
  seq: number;
  when: string;
  trigger: string;
  // The version it came from, by the number the user sees rather than by id.
  restoredFrom: number | null;
}

const TRIGGERS: Record<VersionTrigger, string> = {
  export: "Exported",
  manual_save: "Saved",
  restore: "Restored",
};

// Newest first: the timeline is read from what happened last.
export function versionRows(versions: readonly ResumeVersion[]): VersionRow[] {
  const seqOf = new Map(versions.map((row) => [row.id, row.seq]));

  return [...versions]
    .sort((a, b) => b.seq - a.seq)
    .map((row) => ({
      id: row.id,
      seq: row.seq,
      when: formatTimestamp(row.createdAt),
      trigger: TRIGGERS[row.trigger],
      restoredFrom:
        row.restoredFromVersionId === null ? null : (seqOf.get(row.restoredFromVersionId) ?? null),
    }));
}

// De-camelled rather than mapped: a record kind's own columns are diffed
// generically, so a table of names here would go stale the first time one is
// added to a kind.
export function fieldLabel(field: string): string {
  const spaced = field.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export interface FieldLine {
  key: string;
  label: string;
  from: string;
  to: string;
}

export interface ChangeLine {
  key: string;
  indent: number;
  // Absent when a field line already names the thing, which is a point whose
  // wording is what moved.
  subject: string | null;
  change: ChangeKind;
  fields: FieldLine[];
}

export const CHANGE_LABELS: Record<ChangeKind, string> = {
  added: "Added",
  removed: "Removed",
  moved: "Moved",
  changed: "Changed",
};

// A row that arrived or left differs in every field it has, and the badge beside
// its name already says so: listing them reads as noise around the one word that
// matters.
function fieldLines(
  prefix: string,
  change: ChangeKind,
  fields: readonly FieldChange[],
): FieldLine[] {
  if (change === "added" || change === "removed") return [];
  return fields.map((field) => ({
    key: `${prefix}:${field.field}`,
    label: fieldLabel(field.field),
    from: field.a ?? "nothing",
    to: field.b ?? "nothing",
  }));
}

function pointLine(prefix: string, point: PointChange): ChangeLine {
  const key = `${prefix}:${point.pointId}`;
  const fields = fieldLines(key, point.change, point.fields);
  return {
    key,
    indent: 2,
    // A point is named by its words, so naming it above a line that shows the
    // rewording would print the same sentence twice.
    subject: fields.some((field) => field.key.endsWith(":wording"))
      ? null
      : (point.text ?? "a point"),
    change: point.change,
    fields,
  };
}

function entryLines(prefix: string, entry: EntryChange): ChangeLine[] {
  const key = `${prefix}:${entry.recordId}`;
  return [
    {
      key,
      indent: 1,
      subject: entry.title ?? "an untitled record",
      change: entry.change,
      fields: fieldLines(key, entry.change, entry.fields),
    },
    ...entry.points.map((point) => pointLine(key, point)),
  ];
}

// Flattened, because the shape a reader wants is a list of what happened rather
// than the manifest's tree.
export function diffLines(diff: ManifestDiff): ChangeLine[] {
  const heading = (key: string, subject: string, fields: readonly FieldChange[]): ChangeLine[] =>
    fields.length === 0
      ? []
      : [
          {
            key,
            indent: 0,
            subject,
            change: "changed" as const,
            fields: fieldLines(key, "changed", fields),
          },
        ];

  return [
    ...heading("target", "This resume", diff.target),
    ...heading("profile", "Your details", diff.profile),
    ...diff.sections.flatMap((section) => {
      const key = `${section.kind}:${section.heading}`;
      return [
        {
          key,
          indent: 0,
          subject: section.heading,
          change: section.change,
          fields: fieldLines(key, section.change, section.fields),
        },
        ...section.entries.flatMap((entry) => entryLines(key, entry)),
      ];
    }),
  ];
}
