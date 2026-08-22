import { newUuid } from "@keepcv/core";
import type { Evidence, EvidenceInput, EvidenceKind, Store, Uuid } from "@keepcv/schema";
import { evidenceInputSchema } from "@keepcv/schema";
import { type FieldErrors, fieldErrors } from "../../../lib/form.js";

export const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
  url: "Link",
  note: "Note",
  file: "File",
};

export const EVIDENCE_PLACEHOLDERS: Record<EvidenceKind, string> = {
  url: "https://github.com/you/thing/pull/812",
  note: "Quarterly review, Q3 2025: named as the reason the migration landed",
  file: "~/records/2025-review.pdf",
};

export interface EvidenceFormValues {
  kind: EvidenceKind;
  value: string;
  note: string;
}

export const BLANK_EVIDENCE: EvidenceFormValues = { kind: "url", value: "", note: "" };

export function buildEvidence(
  pointId: Uuid,
  values: EvidenceFormValues,
): { evidence: EvidenceInput } | { errors: FieldErrors } {
  const parsed = evidenceInputSchema.safeParse({
    id: newUuid(),
    pointId,
    kind: values.kind,
    value: values.value.trim(),
    note: values.note.trim() === "" ? null : values.note.trim(),
  });

  return parsed.success ? { evidence: parsed.data } : { errors: fieldErrors(parsed.error) };
}

// Only what a browser will actually open. A path or a malformed link is still
// stored and still shown - it is the user's note to themselves, not a URL field.
export function hrefOf(evidence: Evidence): string | undefined {
  if (evidence.kind !== "url") return undefined;
  try {
    const url = new URL(evidence.value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function evidenceOfPoint(store: Store, pointId: Uuid): Evidence[] {
  return store.evidence.filter((row) => row.pointId === pointId && row.archivedAt === null);
}
