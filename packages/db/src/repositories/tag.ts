import { TagMergedIntoItselfError, type TagRepository, tagSlug } from "@keepcv/core";
import {
  pointTagSchema,
  recordTagSchema,
  type Tag,
  type Timestamp,
  tagSchema,
  type Uuid,
} from "@keepcv/schema";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import { point, pointTag, record, recordTag, tag } from "../schema/index.js";
import {
  type Changes,
  insertOwned,
  live,
  owned,
  requireOwned,
  standardDto,
  updateOwned,
} from "./owned-row.js";

type TagRow = typeof tag.$inferSelect;
type RecordRow = typeof record.$inferSelect;
type PointRow = typeof point.$inferSelect;

function toTag(row: TagRow): Tag {
  return tagSchema.parse({
    ...standardDto(row),
    slug: row.slug,
    label: row.label,
    category: row.category,
  });
}

export function createTagRepository(db: Database): TagRepository {
  async function set(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<TagRow>,
  ): Promise<Tag> {
    return toTag(await updateOwned<TagRow>(db, tag, "tag", id, expectedUpdatedAt, changes));
  }

  // Inserted and then deleted rather than updated in place: a record already
  // carrying both tags would collide with itself on the primary key.
  async function moveRecordTags(from: Uuid, to: Uuid): Promise<void> {
    const carriers = and(eq(recordTag.ownerId, currentOwnerId()), eq(recordTag.tagId, from));
    const rows = await db.select().from(recordTag).where(carriers);
    if (rows.length === 0) return;

    await db
      .insert(recordTag)
      .values(rows.map((row) => ({ ownerId: currentOwnerId(), tagId: to, recordId: row.recordId })))
      .onConflictDoNothing();
    await db.delete(recordTag).where(carriers);
  }

  async function movePointTags(from: Uuid, to: Uuid): Promise<void> {
    const carriers = and(eq(pointTag.ownerId, currentOwnerId()), eq(pointTag.tagId, from));
    const rows = await db.select().from(pointTag).where(carriers);
    if (rows.length === 0) return;

    await db
      .insert(pointTag)
      .values(rows.map((row) => ({ ownerId: currentOwnerId(), tagId: to, pointId: row.pointId })))
      .onConflictDoNothing();
    await db.delete(pointTag).where(carriers);
  }

  return {
    // By label, which is the word the user reads. An archived tag frees its slug
    // and so two can carry one label, which is why the id breaks the tie.
    async list(options) {
      const rows = await db
        .select()
        .from(tag)
        .where(and(owned(tag), live(tag, options?.includeArchived)))
        .orderBy(asc(tag.label), asc(tag.id));
      return rows.map(toTag);
    },

    async get(id) {
      return toTag(await requireOwned<TagRow>(db, tag, "tag", id));
    },

    async create(input) {
      return toTag(await insertOwned(db, tag, "tag", { ...input, slug: tagSlug(input.label) }));
    },

    // The slug follows the label rather than being renamed beside it: it is a
    // projection, and two spellings of one fact are one to keep in step by hand.
    async update(id, patch, expectedUpdatedAt) {
      const slug = patch.label === undefined ? {} : { slug: tagSlug(patch.label) };
      return await set(id, expectedUpdatedAt, { ...patch, ...slug });
    },

    async archive(id, expectedUpdatedAt) {
      return await set(id, expectedUpdatedAt, { archivedAt: new Date() });
    },

    async restore(id, expectedUpdatedAt) {
      return await set(id, expectedUpdatedAt, { archivedAt: null });
    },

    // Archived first, so a stale token refuses before anything moves. Both halves
    // run in one unit of work, so a vocabulary half-merged is not a state the
    // store can be left in.
    async merge(id, intoTagId, expectedUpdatedAt) {
      if (id === intoTagId) {
        throw new TagMergedIntoItselfError(id);
      }
      await requireOwned<TagRow>(db, tag, "tag", intoTagId);
      const merged = await set(id, expectedUpdatedAt, { archivedAt: new Date() });

      await moveRecordTags(id, intoTagId);
      await movePointTags(id, intoTagId);
      return merged;
    },

    async listRecordTags(options) {
      const rows = await db
        .select()
        .from(recordTag)
        .where(
          and(
            eq(recordTag.ownerId, currentOwnerId()),
            options?.recordId === undefined ? undefined : eq(recordTag.recordId, options.recordId),
            options?.tagId === undefined ? undefined : eq(recordTag.tagId, options.tagId),
          ),
        )
        .orderBy(asc(recordTag.tagId), asc(recordTag.recordId));
      return rows.map((row) => recordTagSchema.parse(row));
    },

    // Idempotent, because the pair is the whole row: tagging twice leaves nothing
    // to change. A tag that does not exist fails the foreign key, which is the
    // right answer for a request that was already wrong when it was sent.
    async tagRecord(recordId, tagId) {
      await requireOwned<RecordRow>(db, record, "record", recordId);
      await db
        .insert(recordTag)
        .values({ ownerId: currentOwnerId(), tagId, recordId })
        .onConflictDoNothing();
      return recordTagSchema.parse({ tagId, recordId });
    },

    // Untagging something that was never tagged has already achieved what the
    // caller asked for, so only the record has to exist.
    async untagRecord(recordId, tagId) {
      await requireOwned<RecordRow>(db, record, "record", recordId);
      await db
        .delete(recordTag)
        .where(
          and(
            eq(recordTag.ownerId, currentOwnerId()),
            eq(recordTag.tagId, tagId),
            eq(recordTag.recordId, recordId),
          ),
        );
    },

    async listPointTags(options) {
      const rows = await db
        .select()
        .from(pointTag)
        .where(
          and(
            eq(pointTag.ownerId, currentOwnerId()),
            options?.pointId === undefined ? undefined : eq(pointTag.pointId, options.pointId),
            options?.tagId === undefined ? undefined : eq(pointTag.tagId, options.tagId),
          ),
        )
        .orderBy(asc(pointTag.tagId), asc(pointTag.pointId));
      return rows.map((row) => pointTagSchema.parse(row));
    },

    async tagPoint(pointId, tagId) {
      await requireOwned<PointRow>(db, point, "point", pointId);
      await db
        .insert(pointTag)
        .values({ ownerId: currentOwnerId(), tagId, pointId })
        .onConflictDoNothing();
      return pointTagSchema.parse({ tagId, pointId });
    },

    async untagPoint(pointId, tagId) {
      await requireOwned<PointRow>(db, point, "point", pointId);
      await db
        .delete(pointTag)
        .where(
          and(
            eq(pointTag.ownerId, currentOwnerId()),
            eq(pointTag.tagId, tagId),
            eq(pointTag.pointId, pointId),
          ),
        );
    },
  };
}
