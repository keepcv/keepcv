import { composition } from "@keepcv/core";
import type { Resume, Store, Uuid } from "@keepcv/schema";
import { type ArchivedFilter, matchesArchived } from "../../../lib/archived.js";
import { formatPartialDate } from "../../records/model/record-rows.js";

export interface ResumeRow {
  id: Uuid;
  name: string;
  target: string | null;
  applied: string | null;
  sections: number;
  entries: number;
  points: number;
  // Placed but toggled off, which is the state a selection exists to hold: a
  // resume showing three of eleven points has kept the other eight.
  hidden: number;
  isArchived: boolean;
}

export function targetOf(resume: Resume): string | null {
  const parts = [resume.targetRole, resume.targetCompany].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(" at ");
}

export function toResumeRow(store: Store, resume: Resume): ResumeRow {
  const sections = composition(store, resume.id)?.sections ?? [];
  const entries = sections.flatMap((section) => section.entries);
  const points = entries.flatMap((entry) => entry.points);

  return {
    id: resume.id,
    name: resume.name,
    target: targetOf(resume),
    applied: resume.appliedOn === null ? null : formatPartialDate(resume.appliedOn),
    sections: sections.length,
    entries: entries.length,
    points: points.length,
    hidden:
      sections.filter((row) => !row.section.isVisible).length +
      entries.filter((row) => !row.entry.isVisible).length +
      points.filter((row) => !row.entryPoint.isVisible).length,
    isArchived: resume.archivedAt !== null,
  };
}

export function resumeRows(store: Store, archived: ArchivedFilter): ResumeRow[] {
  return store.resumes
    .filter((resume) => matchesArchived(resume, archived))
    .map((resume) => toResumeRow(store, resume));
}
