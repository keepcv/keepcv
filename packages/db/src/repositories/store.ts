import {
  deriveRevision,
  manifestRefs,
  type Repositories,
  StoreNotEmptyError,
  type StoreRepository,
  tagSlug,
} from "@keepcv/core";
import type { Archive, CareerRecord, Store, Timestamp, Uuid } from "@keepcv/schema";
import { and, eq } from "drizzle-orm";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import {
  agentAttachment,
  agentConversation,
  contactChannel,
  customSection,
  draft,
  evidence,
  metric,
  organisation,
  phrasing,
  phrasingRevision,
  phrasingSet,
  point,
  pointRecordLink,
  pointTag,
  profile,
  record,
  recordField,
  recordLink,
  recordTag,
  resume,
  resumeContactChannel,
  resumeContentRef,
  resumeEntry,
  resumeEntryPoint,
  resumeSection,
  resumeSnapshot,
  resumeVersion,
  roleProfile,
  roleProfileTag,
  savedFilter,
  tag,
  template,
} from "../schema/index.js";
import { insertAll } from "./insert-all.js";
import { owned } from "./owned-row.js";
import { manifestHashOf } from "./resume-version.js";

const everything = { includeArchived: true } as const;

interface Standard {
  id: Uuid;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt: Timestamp | null;
}
function standardRow(entity: Standard, ownerId: Uuid) {
  return {
    id: entity.id,
    ownerId,
    createdAt: new Date(entity.createdAt),
    updatedAt: new Date(entity.updatedAt),
    archivedAt: entity.archivedAt === null ? null : new Date(entity.archivedAt),
  };
}
const kindColumns = {
  employmentType: null,
  mode: null,
  grade: null,
  gradeScale: null,
  thesisTitle: null,
  honours: null,
  category: null,
  proficiency: null,
  credentialId: null,
  expiresOn: null,
  doi: null,
  customSectionId: null,
};

function toRecordRow(entry: CareerRecord, ownerId: Uuid) {
  return { ...kindColumns, ...entry, ...standardRow(entry, ownerId) };
}

export function createStoreRepository(
  db: Database,
  repositories: Omit<Repositories, "store">,
): StoreRepository {
  async function readStore(currentOnly = false): Promise<Store> {
    return {
      profile: await repositories.profile.get(),
      agentConversations: await repositories.agent.list(true),
      contactChannels: await repositories.profile.listContactChannels(everything),
      organisations: await repositories.organisations.list(everything),
      customSections: await repositories.customSections.list(everything),
      records: await repositories.records.list(everything),
      recordLinks: await repositories.records.listLinks(everything),
      recordFields: await repositories.records.listFields(everything),
      phrasingSets: await repositories.phrasings.listSets(everything),
      phrasings: await repositories.phrasings.list(everything),
      phrasingRevisions: await repositories.phrasings.listRevisions({ currentOnly }),
      points: await repositories.points.list(everything),
      pointRecordLinks: await repositories.points.listRecordLinks(),
      metrics: await repositories.points.listMetrics(everything),
      evidence: await repositories.points.listEvidence(everything),
      tags: await repositories.tags.list(everything),
      recordTags: await repositories.tags.listRecordTags(),
      pointTags: await repositories.tags.listPointTags(),
      drafts: await repositories.drafts.list(),
      resumes: await repositories.resumes.list(everything),
      resumeSections: await repositories.resumes.listSections(everything),
      resumeEntries: await repositories.resumes.listEntries(everything),
      resumeEntryPoints: await repositories.resumes.listEntryPoints(everything),
      resumeContactChannels: await repositories.resumes.listContactChannels(),
      savedFilters: await repositories.savedFilters.list(everything),
      roleProfiles: await repositories.roleProfiles.list(everything),
      roleProfileTags: await repositories.roleProfiles.listTags(),
      templates: await repositories.templates.list(everything),
    };
  }
  // phrasing_current_revision_fk and phrasing_set_canonical_fk form a cycle.
  async function loadPhrasings(store: Store, ownerId: Uuid): Promise<void> {
    await insertAll(
      db,
      phrasingSet,
      store.phrasingSets.map((row) => ({
        ...row,
        ...standardRow(row, ownerId),
        canonicalPhrasingId: null,
      })),
    );
    await insertAll(
      db,
      phrasing,
      store.phrasings.map((row) => ({
        ...row,
        ...standardRow(row, ownerId),
        currentRevisionId: null,
      })),
    );
    await insertAll(
      db,
      phrasingRevision,
      store.phrasingRevisions.map((row) => ({
        id: row.id,
        ownerId,
        phrasingId: row.phrasingId,
        createdAt: new Date(row.createdAt),
        ...deriveRevision(row.body),
      })),
    );

    for (const row of store.phrasings.filter((p) => p.currentRevisionId !== null)) {
      await db
        .update(phrasing)
        .set({ currentRevisionId: row.currentRevisionId })
        .where(and(owned(phrasing), eq(phrasing.id, row.id)));
    }
    for (const row of store.phrasingSets.filter((p) => p.canonicalPhrasingId !== null)) {
      await db
        .update(phrasingSet)
        .set({ canonicalPhrasingId: row.canonicalPhrasingId })
        .where(and(owned(phrasingSet), eq(phrasingSet.id, row.id)));
    }
  }
  async function loadPoints(store: Store, ownerId: Uuid): Promise<void> {
    await insertAll(
      db,
      point,
      store.points.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
    );
    await insertAll(
      db,
      pointRecordLink,
      store.pointRecordLinks.map((row) => ({ ...row, ownerId })),
    );
    await insertAll(
      db,
      metric,
      store.metrics.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
    );
    await insertAll(
      db,
      evidence,
      store.evidence.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
    );
    await insertAll(
      db,
      pointTag,
      store.pointTags.map((row) => ({ ...row, ownerId })),
    );
  }
  async function readArchive(): Promise<Archive> {
    const { agentConversations, ...current } = await readStore();
    return {
      ...current,
      agentHistory: await repositories.agent.history(),
      agentAttachments: await repositories.agent.attachments(),
      resumeVersions: await repositories.versions.list(),
      resumeSnapshots: await repositories.versions.listSnapshots(everything),
    };
  }
  async function requireEmpty(): Promise<void> {
    const current = await readArchive();
    for (const [collection, value] of Object.entries(current)) {
      if (Array.isArray(value) && value.length > 0) {
        throw new StoreNotEmptyError(collection);
      }
    }
    const { id, createdAt, updatedAt, archivedAt, ...details } = current.profile;
    if (Object.values(details).some((value) => value !== null)) {
      throw new StoreNotEmptyError("a profile someone has filled in");
    }
  }

  return {
    read: async () => await readArchive(),

    readCurrent: async () => await readStore(true),

    async load(archive) {
      const store: Store = archive;
      await requireEmpty();
      const ownerId = currentOwnerId();

      await insertAll(
        db,
        agentConversation,
        archive.agentHistory.map((row) => ({
          ...standardRow(row, ownerId),
          title: row.title,
          state: { messages: row.messages, actions: row.actions, run: row.run },
        })),
      );
      await insertAll(
        db,
        agentAttachment,
        archive.agentAttachments.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await loadPhrasings(store, ownerId);
      await db
        .update(profile)
        .set({ ...store.profile, ...standardRow(store.profile, ownerId) })
        .where(owned(profile));

      await insertAll(
        db,
        contactChannel,
        store.contactChannels.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        db,
        organisation,
        store.organisations.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        db,
        tag,
        store.tags.map((row) => ({
          ...row,
          ...standardRow(row, ownerId),
          slug: tagSlug(row.label),
        })),
      );
      await insertAll(
        db,
        customSection,
        store.customSections.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        db,
        record,
        store.records.map((row) => toRecordRow(row, ownerId)),
      );
      await insertAll(
        db,
        recordLink,
        store.recordLinks.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        db,
        recordField,
        store.recordFields.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        db,
        recordTag,
        store.recordTags.map((row) => ({ ...row, ownerId })),
      );
      await insertAll(
        db,
        savedFilter,
        store.savedFilters.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        db,
        roleProfile,
        store.roleProfiles.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        db,
        roleProfileTag,
        store.roleProfileTags.map((row) => ({ ...row, ownerId })),
      );

      await loadPoints(store, ownerId);
      await insertAll(
        db,
        template,
        store.templates.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        db,
        resume,
        store.resumes.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        db,
        resumeSection,
        store.resumeSections.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        db,
        resumeEntry,
        store.resumeEntries.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        db,
        resumeEntryPoint,
        store.resumeEntryPoints.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        db,
        resumeContactChannel,
        store.resumeContactChannels.map((row) => ({ ...row, ownerId })),
      );
      await insertAll(
        db,
        resumeVersion,
        archive.resumeVersions.map((row) => ({
          id: row.id,
          ownerId,
          resumeId: row.resumeId,
          seq: row.seq,
          trigger: row.trigger,
          restoredFromVersionId: row.restoredFromVersionId,
          manifest: row.manifest,
          manifestHash: manifestHashOf(row.manifest),
          createdAt: new Date(row.createdAt),
        })),
      );
      await insertAll(
        db,
        resumeSnapshot,
        archive.resumeSnapshots.map((row) => ({
          ...row,
          ...standardRow(row, ownerId),
          starredAt: new Date(row.starredAt),
        })),
      );
      await insertAll(
        db,
        resumeContentRef,
        archive.resumeVersions.flatMap((row) =>
          manifestRefs(row.manifest).map((ref) => ({
            ownerId,
            resumeVersionId: row.id,
            ...ref,
          })),
        ),
      );
      await insertAll(
        db,
        draft,
        store.drafts.map((row) => ({
          ...row,
          ownerId,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        })),
      );
    },
  };
}
