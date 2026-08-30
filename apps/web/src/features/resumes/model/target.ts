import { type TargetTerm, targetMatch, textOfPhrasing } from "@keepcv/core";
import type { Resume, ResumeEntryPoint, ResumePatch, Store, Uuid } from "@keepcv/schema";
import { resumePatchSchema } from "@keepcv/schema";
import { type Difference, differing, trimmed } from "../../../lib/form.js";

export interface TargetValues {
  company: string;
  role: string;
  url: string;
  appliedOn: string;
  jdText: string;
}

export type TargetErrors = Partial<Record<keyof TargetValues, string>>;

const LABELS: Record<keyof TargetValues, string> = {
  company: "Company",
  role: "Role",
  url: "Posting",
  appliedOn: "Applied",
  jdText: "Job description",
};

const FIELD_OF: Record<string, keyof TargetValues> = {
  targetCompany: "company",
  targetRole: "role",
  targetUrl: "url",
  appliedOn: "appliedOn",
  targetJdText: "jdText",
};

export function targetValuesOf(resume: Resume): TargetValues {
  return {
    company: resume.targetCompany ?? "",
    role: resume.targetRole ?? "",
    url: resume.targetUrl ?? "",
    appliedOn: resume.appliedOn ?? "",
    jdText: resume.targetJdText ?? "",
  };
}

export function isChanged(values: TargetValues, resume: Resume): boolean {
  const stored = targetValuesOf(resume);
  return Object.keys(LABELS).some(
    (field) => stored[field as keyof TargetValues] !== values[field as keyof TargetValues],
  );
}

// No `name` and no `templateId`: absent leaves them alone, and this form shows
// neither.
export function buildTargetPatch(
  values: TargetValues,
): { patch: ResumePatch } | { errors: TargetErrors } {
  const parsed = resumePatchSchema.safeParse({
    targetCompany: trimmed(values.company),
    targetRole: trimmed(values.role),
    targetUrl: trimmed(values.url),
    appliedOn: trimmed(values.appliedOn),
    targetJdText: trimmed(values.jdText),
  });

  if (parsed.success) return { patch: parsed.data };

  const errors: TargetErrors = {};
  for (const issue of parsed.error.issues) {
    const field = FIELD_OF[String(issue.path[0])];
    if (field !== undefined) errors[field] ??= issue.message;
  }
  return { errors };
}

// A posting runs to pages, and two of them side by side is not a comparison
// anyone can read.
function measured(value: string): string {
  return value === "empty" ? value : `${String(value.length)} characters`;
}

export function targetDifferences(mine: TargetValues, current: Resume): Difference[] {
  const theirs = targetValuesOf(current);
  const fields = Object.entries(LABELS).map(([field, label]) => ({
    label,
    mine: mine[field as keyof TargetValues],
    theirs: theirs[field as keyof TargetValues],
  }));

  return differing(fields).map((row) =>
    row.label === LABELS.jdText
      ? { ...row, mine: measured(row.mine), theirs: measured(row.theirs) }
      : row,
  );
}

export interface WeakPoint {
  row: ResumeEntryPoint;
  text: string;
  // One wording can sit on three jobs, and the list is unreadable without
  // saying which of them this row is.
  under: string;
  matched: string[];
}

export interface TargetReading {
  covered: TargetTerm[];
  missing: TargetTerm[];
  // Weakest first, which is the order the question "what do I drop" is asked
  // in.
  weakest: WeakPoint[];
}

export function targetReading(store: Store, resumeId: Uuid): TargetReading {
  const match = targetMatch(store, resumeId);
  if (match === undefined) return { covered: [], missing: [], weakest: [] };

  return {
    covered: match.terms.filter((term) => term.isCovered),
    missing: match.terms.filter((term) => !term.isCovered),
    weakest: match.points.flatMap((scored) => {
      const row = store.resumeEntryPoints.find((entry) => entry.id === scored.entryPointId);
      const phrasing = store.phrasings.find((held) => held.id === row?.phrasingId);
      if (row === undefined || phrasing === undefined) return [];

      const entry = store.resumeEntries.find((placed) => placed.id === row.resumeEntryId);
      const record = store.records.find((held) => held.id === entry?.recordId);
      return [
        {
          row,
          text: textOfPhrasing(store, phrasing),
          under: record?.title ?? "Untitled",
          matched: scored.matched,
        },
      ];
    }),
  };
}
