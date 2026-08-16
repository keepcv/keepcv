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

// The owner comes from ambient scope and never from the document, so importing
// somebody else's export cannot write into their store.
function standardRow(entity: Standard, ownerId: Uuid) {
  return {
    id: entity.id,
    ownerId,
    createdAt: new Date(entity.createdAt),
    updatedAt: new Date(entity.updatedAt),
    archivedAt: entity.archivedAt === null ? null : new Date(entity.archivedAt),
  };
}

// Every kind-specific column, so a record row carries the same key set whatever
// its kind is and the columns its kind does not own go in as null.
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
  // Drizzle refuses an insert with no rows, and most collections in an export
  // are empty, so every load below would otherwise carry the same guard.
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
      // The export takes every revision, not just the current one: superseded
      // wordings are things the user wrote, and dropping them is a delete. The
      // boot payload takes the current ones, because history grows without bound
      // and it is fetched on every open.
      phrasingRevisions: await repositories.phrasings.listRevisions({ currentOnly }),
      points: await repositories.points.list(everything),
      pointRecordLinks: await repositories.points.listRecordLinks(),
      metrics: await repositories.points.listMetrics(everything),
      evidence: await repositories.points.listEvidence(everything),
      tags: await repositories.tags.list(everything),
      recordTags: await repositories.tags.listRecordTags(),
      pointTags: await repositories.tags.listPointTags(),
    };
  }

  // In the order the subsystem is created in: each of the three tables references
  // the next, so the pointers back are filled once every row exists
  // (data-model.md #5). It runs before the profile and the records because both
  // can point at a set.
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
    // Derived again rather than trusted: a hand-edited file whose plain text
    // disagrees with its body would otherwise make I8 false in the store.
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

  // Last, because a point references both a record and a phrasing set, and its
  // metrics and evidence reference it.
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

  // Reading the whole store to decide costs kilobytes and covers a collection
  // added to the format later without anyone remembering to extend a list.
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

      // The profile row is created with the owner, so it is overwritten rather
      // than inserted - id included, since the export carries one.
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
      // The slug is derived again rather than trusted, for the reason a
      // revision's plain text is: a hand-edited file whose slug disagrees with
      // its label would otherwise make I17 false in the store it loaded into.
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
    },
  };
}
