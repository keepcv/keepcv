import type { CompositionPlan, PlanChange, Repositories } from "@keepcv/core";
import type { Timestamp, Uuid } from "@keepcv/schema";

async function applyChange<Row extends { updatedAt: Timestamp }, Patch extends object>(
  change: PlanChange<Patch>,
  unarchive: (id: Uuid, token: Timestamp) => Promise<Row>,
  update: (id: Uuid, patch: Patch, token: Timestamp) => Promise<Row>,
): Promise<void> {
  const token = change.unarchive
    ? (await unarchive(change.id, change.expectedUpdatedAt)).updatedAt
    : change.expectedUpdatedAt;
  if (Object.keys(change.patch).length > 0) await update(change.id, change.patch, token);
}

// In order: a section exists before an entry names it, and an entry before the
// points under it.
export async function applyCompositionPlan(
  repositories: Repositories,
  plan: CompositionPlan,
): Promise<void> {
  const resumes = repositories.resumes;

  for (const input of plan.addSections) await resumes.addSection(input);
  for (const change of plan.sections) {
    await applyChange(
      change,
      async (id, token) => await resumes.restoreSection(id, token),
      async (id, patch, token) => await resumes.updateSection(id, patch, token),
    );
  }

  for (const input of plan.addEntries) await resumes.addEntry(input);
  for (const change of plan.entries) {
    await applyChange(
      change,
      async (id, token) => await resumes.restoreEntry(id, token),
      async (id, patch, token) => await resumes.updateEntry(id, patch, token),
    );
  }

  for (const input of plan.addEntryPoints) await resumes.addEntryPoint(input);
  for (const change of plan.entryPoints) {
    await applyChange(
      change,
      async (id, token) => await resumes.restoreEntryPoint(id, token),
      async (id, patch, token) => await resumes.updateEntryPoint(id, patch, token),
    );
  }
}
