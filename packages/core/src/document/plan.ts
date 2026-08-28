import type {
  ResumeEntryInput,
  ResumeEntryPatch,
  ResumeEntryPointInput,
  ResumeEntryPointPatch,
  ResumeSectionInput,
  ResumeSectionPatch,
  SortKey,
  Timestamp,
  Uuid,
} from "@keepcv/schema";
import { generateKeyBetween } from "../ordering/sort-key.js";

export interface PlanChange<Patch> {
  id: Uuid;
  patch: Patch;
  expectedUpdatedAt: Timestamp;
  unarchive: boolean;
}

// Changes to a resume's composition, as the writes to make rather than as rows.
// A restore and a role profile both answer one, and one applier writes both.
export interface CompositionPlan {
  resumeId: Uuid;
  addSections: ResumeSectionInput[];
  sections: PlanChange<ResumeSectionPatch>[];
  addEntries: ResumeEntryInput[];
  entries: PlanChange<ResumeEntryPatch>[];
  addEntryPoints: ResumeEntryPointInput[];
  entryPoints: PlanChange<ResumeEntryPointPatch>[];
}

export function emptyPlan(resumeId: Uuid): CompositionPlan {
  return {
    resumeId,
    addSections: [],
    sections: [],
    addEntries: [],
    entries: [],
    addEntryPoints: [],
    entryPoints: [],
  };
}

// Fresh keys above everything the scope already holds: reassigning inside the
// range in use collides with a key still on a row, and none of the sort-key
// unique indexes is deferrable.
export function above(taken: readonly string[]): () => SortKey {
  let last: string | null = [...taken].sort().at(-1) ?? null;
  return () => {
    const next = generateKeyBetween(last, null);
    last = next;
    return next;
  };
}

// Only what differs, so a plan that agrees with a row does not bump a
// concurrency token no edit was in conflict with. `undefined` means the plan
// says nothing about the field; `null` clears it.
export function sparse<Patch extends object>(wanted: Patch, row: object): Patch {
  const patch = {} as Record<string, unknown>;
  const current = row as Record<string, unknown>;
  for (const [key, value] of Object.entries(wanted)) {
    if (value !== undefined && current[key] !== value) patch[key] = value;
  }
  return patch as Patch;
}

export function change<Patch extends object>(
  row: { id: Uuid; updatedAt: Timestamp; archivedAt: string | null },
  patch: Patch,
): PlanChange<Patch>[] {
  const unarchive = row.archivedAt !== null;
  if (!unarchive && Object.keys(patch).length === 0) return [];
  return [{ id: row.id, patch, expectedUpdatedAt: row.updatedAt, unarchive }];
}
