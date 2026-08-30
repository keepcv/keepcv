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
import { and, asc, eq, inArray, type SQL } from "drizzle-orm";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import { record, recordField, recordLink, recordTag } from "../schema/index.js";
import {
  bySortKey,
  type Changes,
  insertOwned,
  live,
  owned,
  requireOwned,
  standardDto,
  updateOwned,
} from "./owned-row.js";

type RecordRow = typeof record.$inferSelect;
type RecordLinkRow = typeof recordLink.$inferSelect;
type RecordFieldRow = typeof recordField.$inferSelect;

// Every column goes to the union and the kind's own member decides which
// survive: the ones another kind owns are not in its shape, so Zod drops them.
function toCareerRecord(row: RecordRow): CareerRecord {
  const { ownerId: _ownerId, ...rest } = row;
  return careerRecordSchema.parse({ ...rest, ...standardDto(row) });
}

function toRecordLink(row: RecordLinkRow): RecordLink {
  return recordLinkSchema.parse({
    ...standardDto(row),
    recordId: row.recordId,
    kind: row.kind,
    label: row.label,
    url: row.url,
    sortKey: row.sortKey,
  });
}

function toRecordField(row: RecordFieldRow): RecordField {
  return recordFieldSchema.parse({
    ...standardDto(row),
    recordId: row.recordId,
    key: row.key,
    label: row.label,
    value: row.value,
    valueKind: row.valueKind,
    sortKey: row.sortKey,
  });
}

export function createCareerRecordRepository(db: Database): CareerRecordRepository {
  // A subquery, not a join: the select stays one row per record.
  function carriesTag(tagId: Uuid | undefined): SQL | undefined {
    if (tagId === undefined) return undefined;
    return inArray(
      record.id,
      db
        .select({ id: recordTag.recordId })
        .from(recordTag)
        .where(and(eq(recordTag.ownerId, currentOwnerId()), eq(recordTag.tagId, tagId))),
    );
  }

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
    // Sort keys are unique per kind, so a cross-kind list orders by kind first.
    async list(options) {
      const rows = await db
        .select()
        .from(record)
        .where(
          and(
            owned(record),
            options?.kind === undefined ? undefined : eq(record.kind, options.kind),
            carriesTag(options?.tagId),
            live(record, options?.includeArchived),
          ),
        )
        .orderBy(asc(record.kind), bySortKey(record.sortKey));
      return rows.map(toCareerRecord);
    },

    async get(id) {
      return toCareerRecord(await requireOwned<RecordRow>(db, record, "record", id));
    },

    async create(input) {
      return toCareerRecord(await insertOwned(db, record, "record", input));
    },

    // Read back rather than added to the predicate, so a patch aimed at the
    // wrong kind reports that instead of a missing row or a stale token.
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
        .orderBy(asc(recordLink.recordId), bySortKey(recordLink.sortKey));
      return rows.map(toRecordLink);
    },

    async getLink(id) {
      return toRecordLink(await requireOwned<RecordLinkRow>(db, recordLink, "recordLink", id));
    },

    async createLink(input) {
      return toRecordLink(await insertOwned(db, recordLink, "recordLink", input));
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
        .orderBy(asc(recordField.recordId), bySortKey(recordField.sortKey));
      return rows.map(toRecordField);
    },

    async getField(id) {
      return toRecordField(await requireOwned<RecordFieldRow>(db, recordField, "recordField", id));
    },

    async createField(input) {
      return toRecordField(await insertOwned(db, recordField, "recordField", input));
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
