import { CareerRecordKindMismatchError, type CareerRecordRepository } from "@keepcv/core";
import {
  type CareerRecord,
  careerRecordKindSchema,
  careerRecordSchema,
  type RecordField,
  type RecordLink,
  recordFieldSchema,
  recordLinkSchema,
  type Timestamp,
  type Uuid,
} from "@keepcv/schema";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import { record, recordField, recordLink } from "../schema/index.js";
import { type Changes, live, owned, requireOwned, toTimestamp, updateOwned } from "./owned-row.js";

type RecordRow = typeof record.$inferSelect;
type RecordLinkRow = typeof recordLink.$inferSelect;
type RecordFieldRow = typeof recordField.$inferSelect;

// Every column goes to the union and the row's kind decides which of them
// survive: the ones another kind owns are not in that member's shape, so Zod
// drops them. That is what keeping ten kinds in one table costs, and it is one
// function rather than a ten-branch switch.
function toCareerRecord(row: RecordRow): CareerRecord {
  const { ownerId: _ownerId, createdAt, updatedAt, archivedAt, ...rest } = row;
  return careerRecordSchema.parse({
    ...rest,
    createdAt: toTimestamp(createdAt),
    updatedAt: toTimestamp(updatedAt),
    archivedAt: archivedAt === null ? null : toTimestamp(archivedAt),
  });
}

function toRecordLink(row: RecordLinkRow): RecordLink {
  return recordLinkSchema.parse({
    id: row.id,
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
    archivedAt: row.archivedAt === null ? null : toTimestamp(row.archivedAt),
    recordId: row.recordId,
    kind: row.kind,
    label: row.label,
    url: row.url,
    sortKey: row.sortKey,
  });
}

function toRecordField(row: RecordFieldRow): RecordField {
  return recordFieldSchema.parse({
    id: row.id,
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
    archivedAt: row.archivedAt === null ? null : toTimestamp(row.archivedAt),
    recordId: row.recordId,
    key: row.key,
    label: row.label,
    value: row.value,
    valueKind: row.valueKind,
    sortKey: row.sortKey,
  });
}

export function createCareerRecordRepository(db: Database): CareerRecordRepository {
  async function setRecord(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<RecordRow>,
  ): Promise<CareerRecord> {
    return toCareerRecord(
      await updateOwned<RecordRow>(db, record, "record", id, expectedUpdatedAt, changes),
    );
  }

  async function setLink(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<RecordLinkRow>,
  ): Promise<RecordLink> {
    return toRecordLink(
      await updateOwned<RecordLinkRow>(
        db,
        recordLink,
        "recordLink",
        id,
        expectedUpdatedAt,
        changes,
      ),
    );
  }

  async function setField(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<RecordFieldRow>,
  ): Promise<RecordField> {
    return toRecordField(
      await updateOwned<RecordFieldRow>(
        db,
        recordField,
        "recordField",
        id,
        expectedUpdatedAt,
        changes,
      ),
    );
  }

  return {
    // Sort keys are unique per kind, so a cross-kind list orders by kind first;
    // otherwise two records from different lists would interleave arbitrarily.
    async list(options) {
      const rows = await db
        .select()
        .from(record)
        .where(
          and(
            owned(record),
            options?.kind === undefined ? undefined : eq(record.kind, options.kind),
            live(record, options?.includeArchived),
          ),
        )
        .orderBy(asc(record.kind), asc(record.sortKey));
      return rows.map(toCareerRecord);
    },

    async get(id) {
      return toCareerRecord(await requireOwned<RecordRow>(db, record, "record", id));
    },

    async create(input) {
      const [row] = await db
        .insert(record)
        .values({ ...input, ownerId: currentOwnerId() })
        .returning();
      if (row === undefined) {
        throw new Error("insert into record returned no row");
      }
      return toCareerRecord(row);
    },

    // The kind is read back rather than added to the update's predicate, so a
    // patch aimed at the wrong kind is reported as exactly that instead of
    // arriving as a missing row or a stale token.
    async update(id, patch, expectedUpdatedAt) {
      const { kind, ...changes } = patch;
      const current = await requireOwned<RecordRow>(db, record, "record", id);
      if (current.kind !== kind) {
        throw new CareerRecordKindMismatchError(
          id,
          kind,
          careerRecordKindSchema.parse(current.kind),
        );
      }
      return await setRecord(id, expectedUpdatedAt, changes);
    },

    async archive(id, expectedUpdatedAt) {
      return await setRecord(id, expectedUpdatedAt, { archivedAt: new Date() });
    },

    async restore(id, expectedUpdatedAt) {
      return await setRecord(id, expectedUpdatedAt, { archivedAt: null });
    },

    async listLinks(options) {
      const rows = await db
        .select()
        .from(recordLink)
        .where(
          and(
            owned(recordLink),
            options?.recordId === undefined ? undefined : eq(recordLink.recordId, options.recordId),
            live(recordLink, options?.includeArchived),
          ),
        )
        .orderBy(asc(recordLink.recordId), asc(recordLink.sortKey));
      return rows.map(toRecordLink);
    },

    async createLink(input) {
      const [row] = await db
        .insert(recordLink)
        .values({ ...input, ownerId: currentOwnerId() })
        .returning();
      if (row === undefined) {
        throw new Error("insert into record_link returned no row");
      }
      return toRecordLink(row);
    },

    async updateLink(id, patch, expectedUpdatedAt) {
      return await setLink(id, expectedUpdatedAt, patch);
    },

    async archiveLink(id, expectedUpdatedAt) {
      return await setLink(id, expectedUpdatedAt, { archivedAt: new Date() });
    },

    async restoreLink(id, expectedUpdatedAt) {
      return await setLink(id, expectedUpdatedAt, { archivedAt: null });
    },

    async listFields(options) {
      const rows = await db
        .select()
        .from(recordField)
        .where(
          and(
            owned(recordField),
            options?.recordId === undefined
              ? undefined
              : eq(recordField.recordId, options.recordId),
            live(recordField, options?.includeArchived),
          ),
        )
        .orderBy(asc(recordField.recordId), asc(recordField.sortKey));
      return rows.map(toRecordField);
    },

    async createField(input) {
      const [row] = await db
        .insert(recordField)
        .values({ ...input, ownerId: currentOwnerId() })
        .returning();
      if (row === undefined) {
        throw new Error("insert into record_field returned no row");
      }
      return toRecordField(row);
    },

    async updateField(id, patch, expectedUpdatedAt) {
      return await setField(id, expectedUpdatedAt, patch);
    },

    async archiveField(id, expectedUpdatedAt) {
      return await setField(id, expectedUpdatedAt, { archivedAt: new Date() });
    },

    async restoreField(id, expectedUpdatedAt) {
      return await setField(id, expectedUpdatedAt, { archivedAt: null });
    },
  };
}
