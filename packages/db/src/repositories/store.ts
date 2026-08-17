import {
  deriveRevision,
  type Repositories,
  StoreNotEmptyError,
  type StoreRepository,
  tagSlug,
} from "@keepcv/core";
import type { CareerRecord, Store, Timestamp, Uuid } from "@keepcv/schema";
import { and, eq } from "drizzle-orm";
import type { PgInsertValue, PgTable } from "drizzle-orm/pg-core";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import {
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
  tag,
} from "../schema/index.js";
import { owned } from "./owned-row.js";

const everything = { includeArchived: true } as const;

interface Standard {
  id: Uuid;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt: Timestamp | null;
}

// The owner comes from ambient scope, never from the document.
function standardRow(entity: Standard, ownerId: Uuid) {
  return {
    id: entity.id,
    ownerId,
    createdAt: new Date(entity.createdAt),
    updatedAt: new Date(entity.updatedAt),
    archivedAt: entity.archivedAt === null ? null : new Date(entity.archivedAt),
  };
}

// So a record row carries the same key set whatever its kind is.
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
  // Drizzle refuses an insert with no rows, and most collections are empty.
  async function insertAll<T extends PgTable>(table: T, values: PgInsertValue<T>[]): Promise<void> {
    if (values.length > 0) {
      await db.insert(table).values(values);
    }
  }

  async function read(currentOnly = false): Promise<Store> {
    return {
      profile: await repositories.profile.get(),
      contactChannels: await repositories.profile.listContactChannels(everything),
      organisations: await repositories.organisations.list(everything),
      customSections: await repositories.customSections.list(everything),
      records: await repositories.records.list(everything),
      recordLinks: await repositories.records.listLinks(everything),
      recordFields: await repositories.records.listFields(everything),
      phrasingSets: await repositories.phrasings.listSets(everything),
      phrasings: await repositories.phrasings.list(everything),
      // The export takes every revision: dropping a superseded wording is a
      // delete. The boot payload takes the current ones (api-contract.md #3).
      phrasingRevisions: await repositories.phrasings.listRevisions({ currentOnly }),
      points: await repositories.points.list(everything),
      pointRecordLinks: await repositories.points.listRecordLinks(),
      metrics: await repositories.points.listMetrics(everything),
      evidence: await repositories.points.listEvidence(everything),
      tags: await repositories.tags.list(everything),
      recordTags: await repositories.tags.listRecordTags(),
      pointTags: await repositories.tags.listPointTags(),
      drafts: await repositories.drafts.list(),
    };
  }

  // Each of the three references the next, so the pointers back are filled once
  // every row exists. Before the profile and the records, which point at a set.
  async function loadPhrasings(store: Store, ownerId: Uuid): Promise<void> {
    await insertAll(
      phrasingSet,
      store.phrasingSets.map((row) => ({
        ...row,
        ...standardRow(row, ownerId),
        canonicalPhrasingId: null,
      })),
    );
    await insertAll(
      phrasing,
      store.phrasings.map((row) => ({
        ...row,
        ...standardRow(row, ownerId),
        currentRevisionId: null,
      })),
    );
    // Derived again rather than trusted, or a hand-edited file makes I8 false.
    await insertAll(
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

  // Last: a point references a record and a phrasing set, and is referenced by
  // its metrics and evidence.
  async function loadPoints(store: Store, ownerId: Uuid): Promise<void> {
    await insertAll(
      point,
      store.points.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
    );
    await insertAll(
      pointRecordLink,
      store.pointRecordLinks.map((row) => ({ ...row, ownerId })),
    );
    await insertAll(
      metric,
      store.metrics.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
    );
    await insertAll(
      evidence,
      store.evidence.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
    );
    await insertAll(
      pointTag,
      store.pointTags.map((row) => ({ ...row, ownerId })),
    );
  }

  // Reading the whole store covers a collection added to the format later.
  async function requireEmpty(): Promise<void> {
    const current = await read();
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
    read: async () => await read(),

    readCurrent: async () => await read(true),

    async load(store) {
      await requireEmpty();
      const ownerId = currentOwnerId();

      await loadPhrasings(store, ownerId);

      // Created with the owner, so it is overwritten rather than inserted.
      await db
        .update(profile)
        .set({ ...store.profile, ...standardRow(store.profile, ownerId) })
        .where(owned(profile));

      await insertAll(
        contactChannel,
        store.contactChannels.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        organisation,
        store.organisations.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      // Derived again rather than trusted, or a hand-edited file makes I17 false.
      await insertAll(
        tag,
        store.tags.map((row) => ({
          ...row,
          ...standardRow(row, ownerId),
          slug: tagSlug(row.label),
        })),
      );
      // Before the records, which is the only table that references one.
      await insertAll(
        customSection,
        store.customSections.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        record,
        store.records.map((row) => toRecordRow(row, ownerId)),
      );
      await insertAll(
        recordLink,
        store.recordLinks.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        recordField,
        store.recordFields.map((row) => ({ ...row, ...standardRow(row, ownerId) })),
      );
      await insertAll(
        recordTag,
        store.recordTags.map((row) => ({ ...row, ownerId })),
      );

      await loadPoints(store, ownerId);

      // Last: a draft names a row above, and the repository checks it is there.
      await insertAll(
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
