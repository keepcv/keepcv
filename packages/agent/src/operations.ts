import { AgentRefusalError, type Repositories } from "@keepcv/core";
import type { AgentOperation } from "@keepcv/schema";
export async function applyOperation(r: Repositories, operation: AgentOperation): Promise<void> {
  switch (operation.type) {
    case "records.create":
      await r.records.create(operation.input);
      return;
    case "records.update":
      await r.records.update(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "records.archive":
      await r.records.archive(operation.id, operation.expectedUpdatedAt);
      return;
    case "records.restore":
      await r.records.restore(operation.id, operation.expectedUpdatedAt);
      return;
    case "organisations.create":
      await r.organisations.create(operation.input);
      return;
    case "organisations.update":
      await r.organisations.update(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "organisations.archive":
      await r.organisations.archive(operation.id, operation.expectedUpdatedAt);
      return;
    case "organisations.restore":
      await r.organisations.restore(operation.id, operation.expectedUpdatedAt);
      return;
    case "customSections.create":
      await r.customSections.create(operation.input);
      return;
    case "customSections.update":
      await r.customSections.update(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "customSections.archive":
      await r.customSections.archive(operation.id, operation.expectedUpdatedAt);
      return;
    case "customSections.restore":
      await r.customSections.restore(operation.id, operation.expectedUpdatedAt);
      return;
    case "savedFilters.create":
      await r.savedFilters.create(operation.input);
      return;
    case "savedFilters.update":
      await r.savedFilters.update(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "savedFilters.archive":
      await r.savedFilters.archive(operation.id, operation.expectedUpdatedAt);
      return;
    case "savedFilters.restore":
      await r.savedFilters.restore(operation.id, operation.expectedUpdatedAt);
      return;
    case "roleProfiles.create":
      await r.roleProfiles.create(operation.input);
      return;
    case "roleProfiles.update":
      await r.roleProfiles.update(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "roleProfiles.archive":
      await r.roleProfiles.archive(operation.id, operation.expectedUpdatedAt);
      return;
    case "roleProfiles.restore":
      await r.roleProfiles.restore(operation.id, operation.expectedUpdatedAt);
      return;
    case "tags.create":
      await r.tags.create(operation.input);
      return;
    case "tags.update":
      await r.tags.update(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "tags.archive":
      await r.tags.archive(operation.id, operation.expectedUpdatedAt);
      return;
    case "tags.restore":
      await r.tags.restore(operation.id, operation.expectedUpdatedAt);
      return;
    case "resumes.create":
      await r.resumes.create(operation.input);
      return;
    case "resumes.update":
      await r.resumes.update(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "resumes.archive":
      await r.resumes.archive(operation.id, operation.expectedUpdatedAt);
      return;
    case "resumes.restore":
      await r.resumes.restore(operation.id, operation.expectedUpdatedAt);
      return;
    case "contactChannels.create":
      await r.profile.createContactChannel(operation.input);
      return;
    case "contactChannels.update":
      await r.profile.updateContactChannel(
        operation.id,
        operation.patch,
        operation.expectedUpdatedAt,
      );
      return;
    case "contactChannels.archive":
      await r.profile.archiveContactChannel(operation.id, operation.expectedUpdatedAt);
      return;
    case "contactChannels.restore":
      await r.profile.restoreContactChannel(operation.id, operation.expectedUpdatedAt);
      return;
    case "recordLinks.create":
      await r.records.createLink(operation.input);
      return;
    case "recordLinks.update":
      await r.records.updateLink(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "recordLinks.archive":
      await r.records.archiveLink(operation.id, operation.expectedUpdatedAt);
      return;
    case "recordLinks.restore":
      await r.records.restoreLink(operation.id, operation.expectedUpdatedAt);
      return;
    case "recordFields.create":
      await r.records.createField(operation.input);
      return;
    case "recordFields.update":
      await r.records.updateField(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "recordFields.archive":
      await r.records.archiveField(operation.id, operation.expectedUpdatedAt);
      return;
    case "recordFields.restore":
      await r.records.restoreField(operation.id, operation.expectedUpdatedAt);
      return;
    case "points.create":
      await r.points.create(operation.input);
      return;
    case "points.update":
      await r.points.update(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "points.archive":
      await r.points.archive(operation.id, operation.expectedUpdatedAt);
      return;
    case "points.restore":
      await r.points.restore(operation.id, operation.expectedUpdatedAt);
      return;
    case "metrics.create":
      await r.points.createMetric(operation.input);
      return;
    case "metrics.update":
      await r.points.updateMetric(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "metrics.archive":
      await r.points.archiveMetric(operation.id, operation.expectedUpdatedAt);
      return;
    case "metrics.restore":
      await r.points.restoreMetric(operation.id, operation.expectedUpdatedAt);
      return;
    case "phrasingSets.create":
      await r.phrasings.createSet(operation.input);
      return;
    case "phrasingSets.update":
      await r.phrasings.updateSet(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "phrasingSets.archive":
      await r.phrasings.archiveSet(operation.id, operation.expectedUpdatedAt);
      return;
    case "phrasingSets.restore":
      await r.phrasings.restoreSet(operation.id, operation.expectedUpdatedAt);
      return;
    case "phrasings.create":
      await r.phrasings.create(operation.input);
      return;
    case "phrasings.update":
      await r.phrasings.update(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "phrasings.archive":
      await r.phrasings.archive(operation.id, operation.expectedUpdatedAt);
      return;
    case "phrasings.restore":
      await r.phrasings.restore(operation.id, operation.expectedUpdatedAt);
      return;
    case "resumeSections.create":
      await r.resumes.addSection(operation.input);
      return;
    case "resumeSections.update":
      await r.resumes.updateSection(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "resumeSections.archive":
      await r.resumes.archiveSection(operation.id, operation.expectedUpdatedAt);
      return;
    case "resumeSections.restore":
      await r.resumes.restoreSection(operation.id, operation.expectedUpdatedAt);
      return;
    case "resumeEntries.create":
      await r.resumes.addEntry(operation.input);
      return;
    case "resumeEntries.update":
      await r.resumes.updateEntry(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "resumeEntries.archive":
      await r.resumes.archiveEntry(operation.id, operation.expectedUpdatedAt);
      return;
    case "resumeEntries.restore":
      await r.resumes.restoreEntry(operation.id, operation.expectedUpdatedAt);
      return;
    case "resumeEntryPoints.create":
      await r.resumes.addEntryPoint(operation.input);
      return;
    case "resumeEntryPoints.update":
      await r.resumes.updateEntryPoint(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "resumeEntryPoints.archive":
      await r.resumes.archiveEntryPoint(operation.id, operation.expectedUpdatedAt);
      return;
    case "resumeEntryPoints.restore":
      await r.resumes.restoreEntryPoint(operation.id, operation.expectedUpdatedAt);
      return;
    case "snapshots.create":
      await r.versions.star(operation.input);
      return;
    case "snapshots.update":
      await r.versions.updateSnapshot(operation.id, operation.patch, operation.expectedUpdatedAt);
      return;
    case "snapshots.archive":
      await r.versions.archiveSnapshot(operation.id, operation.expectedUpdatedAt);
      return;
    case "snapshots.restore":
      await r.versions.restoreSnapshot(operation.id, operation.expectedUpdatedAt);
      return;
    case "profile.update":
      await r.profile.update(operation.patch, operation.expectedUpdatedAt);
      return;
    case "wording.append":
      await r.agent.checkRevision(operation.id, operation.expectedRevisionId);
      if ((await r.drafts.list()).some((draft) => draft.targetId === operation.id))
        throw new AgentRefusalError("A wording draft needs review before this change.", 409);
      await r.phrasings.addRevision(operation.id, operation.body);
      return;
    case "tags.merge":
      await r.tags.merge(operation.id, operation.intoTagId, operation.expectedUpdatedAt);
      return;
    case "tags.assign":
      if (operation.subject === "record") {
        if (operation.assigned) await r.tags.tagRecord(operation.id, operation.tagId);
        else await r.tags.untagRecord(operation.id, operation.tagId);
      } else if (operation.subject === "point") {
        if (operation.assigned) await r.tags.tagPoint(operation.id, operation.tagId);
        else await r.tags.untagPoint(operation.id, operation.tagId);
      } else {
        if (operation.assigned) await r.roleProfiles.addTag(operation.id, operation.tagId);
        else await r.roleProfiles.removeTag(operation.id, operation.tagId);
      }
      return;
  }
}
