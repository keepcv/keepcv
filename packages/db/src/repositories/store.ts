import { type Repositories, StoreNotEmptyError, type StoreRepository } from "@keepcv/core";
import type { CareerRecord, Store, Timestamp, Uuid } from "@keepcv/schema";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import {
  contactChannel,
  organisation,
  profile,
  record,
  recordField,
  recordLink,
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
};

function toRecordRow(entry: CareerRecord, ownerId: Uuid) {
  return { ...kindColumns, ...entry, ...standardRow(entry, ownerId) };
}

export function createStoreRepository(
  db: Database,
  repositories: Omit<Repositories, "store">,
): StoreRepository {
  async function read(): Promise<Store> {
    return {
      profile: await repositories.profile.get(),
      contactChannels: await repositories.profile.listContactChannels(everything),
      organisations: await repositories.organisations.list(everything),
      records: await repositories.records.list(everything),
      recordLinks: await repositories.records.listLinks(everything),
      recordFields: await repositories.records.listFields(everything),
    };
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
    read,

    async load(store) {
      await requireEmpty();
      const ownerId = currentOwnerId();

      // The profile row is created with the owner, so it is overwritten rather
      // than inserted - id included, since the export carries one.
      await db
        .update(profile)
        .set({ ...store.profile, ...standardRow(store.profile, ownerId) })
        .where(owned(profile));

      if (store.contactChannels.length > 0) {
        await db
          .insert(contactChannel)
          .values(store.contactChannels.map((row) => ({ ...row, ...standardRow(row, ownerId) })));
      }
      if (store.organisations.length > 0) {
        await db
          .insert(organisation)
          .values(store.organisations.map((row) => ({ ...row, ...standardRow(row, ownerId) })));
      }
      if (store.records.length > 0) {
        await db.insert(record).values(store.records.map((row) => toRecordRow(row, ownerId)));
      }
      if (store.recordLinks.length > 0) {
        await db
          .insert(recordLink)
          .values(store.recordLinks.map((row) => ({ ...row, ...standardRow(row, ownerId) })));
      }
      if (store.recordFields.length > 0) {
        await db
          .insert(recordField)
          .values(store.recordFields.map((row) => ({ ...row, ...standardRow(row, ownerId) })));
      }
    },
  };
}
