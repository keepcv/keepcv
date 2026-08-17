import {
  compile,
  composition,
  live,
  organisationOf,
  pointsOfRecord,
  sectionHeading,
  textOfPhrasing,
} from "@keepcv/core";
import type { Resume, ResumeDocument, Store, Uuid } from "@keepcv/schema";
import { formatPeriod } from "../../records/model/record-rows.js";
import { type ResumeRow, toResumeRow } from "./resume-rows.js";

export interface CompositionPoint {
  id: Uuid;
  text: string;
  // The chosen wording's label, so a resume saying something other than the
  // canonical phrasing says which one it is.
  variant: string | null;
  isVisible: boolean;
  isArchived: boolean;
}

export interface CompositionEntry {
  id: Uuid;
  recordId: Uuid;
  title: string;
  organisation: string | null;
  period: string | null;
  isVisible: boolean;
  isArchived: boolean;
  points: CompositionPoint[];
  // What the record could have contributed: a skill with none says nothing, and
  // a job with six and none chosen is worth saying out loud.
  available: number;
}

export interface CompositionSection {
  id: Uuid;
  heading: string;
  isVisible: boolean;
  entries: CompositionEntry[];
}

export interface ResumeDetail {
  resume: Resume;
  row: ResumeRow;
  sections: CompositionSection[];
  document: ResumeDocument | undefined;
}

// Both halves of the same screen: the composition is every row the selection
// holds, and the document is what survives it (application-structure.md #5.5).
export function resumeDetail(store: Store, resumeId: Uuid, asOf: string): ResumeDetail | undefined {
  const composed = composition(store, resumeId);
  if (composed === undefined) return undefined;

  return {
    resume: composed.resume,
    row: toResumeRow(store, composed.resume),
    sections: composed.sections.map((section) => ({
      id: section.section.id,
      heading: sectionHeading(store, section.section),
      isVisible: section.section.isVisible,
      entries: section.entries.map((entry) => ({
        id: entry.entry.id,
        recordId: entry.record.id,
        title: entry.record.title ?? "Untitled",
        organisation: organisationOf(store, entry.record)?.name ?? null,
        period: formatPeriod(entry.record),
        isVisible: entry.entry.isVisible,
        isArchived: entry.record.archivedAt !== null,
        available: live(pointsOfRecord(store, entry.record.id)).length,
        points: entry.points.map((point) => ({
          id: point.entryPoint.id,
          text: textOfPhrasing(store, point.phrasing),
          variant: point.phrasing.label,
          isVisible: point.entryPoint.isVisible,
          isArchived: point.point.archivedAt !== null,
        })),
      })),
    })),
    document: compile(store, resumeId, { generatedAt: asOf }),
  };
}
