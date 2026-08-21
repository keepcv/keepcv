import { deriveRevision, newUuid, type PhrasingRepository } from "@keepcv/core";
import type {
  Phrasing,
  PhrasingInput,
  PhrasingRevision,
  PhrasingSet,
  RichText,
  Timestamp,
  Uuid,
} from "@keepcv/schema";
import { phrasingRevisionSchema, phrasingSchema, phrasingSetSchema } from "@keepcv/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import { phrasing, phrasingRevision, phrasingSet } from "../schema/index.js";
import {
  bySortKey,
  type Changes,
  insertOwned,
  live,
  owned,
  requireOwned,
  standardDto,
  toTimestamp,
  updateOwned,
} from "./owned-row.js";

type PhrasingSetRow = typeof phrasingSet.$inferSelect;
type PhrasingRow = typeof phrasing.$inferSelect;
type PhrasingRevisionRow = typeof phrasingRevision.$inferSelect;

function toPhrasingSet(row: PhrasingSetRow): PhrasingSet {
  return phrasingSetSchema.parse({
    ...standardDto(row),
    purpose: row.purpose,
    canonicalPhrasingId: row.canonicalPhrasingId,
  });
}

function toPhrasing(row: PhrasingRow): Phrasing {
  return phrasingSchema.parse({
    ...standardDto(row),
    phrasingSetId: row.phrasingSetId,
    variant: row.variant,
    label: row.label,
    sortKey: row.sortKey,
    currentRevisionId: row.currentRevisionId,
  });
}

function toPhrasingRevision(row: PhrasingRevisionRow): PhrasingRevision {
  return phrasingRevisionSchema.parse({
    id: row.id,
    createdAt: toTimestamp(row.createdAt),
    phrasingId: row.phrasingId,
    body: row.body,
    plainText: row.plainText,
    charCount: row.charCount,
    contentHash: row.contentHash,
  });
}

export function createPhrasingRepository(db: Database): PhrasingRepository {
  async function setSet(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<PhrasingSetRow>,
  ): Promise<PhrasingSet> {
    return toPhrasingSet(
      await updateOwned<PhrasingSetRow>(
        db,
        phrasingSet,
        "phrasingSet",
        id,
        expectedUpdatedAt,
        changes,
      ),
    );
  }

  async function setPhrasing(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<PhrasingRow>,
  ): Promise<Phrasing> {
    return toPhrasing(
      await updateOwned<PhrasingRow>(db, phrasing, "phrasing", id, expectedUpdatedAt, changes),
    );
  }

  // Points the phrasing at the result either way, so reverting to an earlier
  // wording moves the pointer back rather than duplicating it (I3).
  async function append(phrasingId: Uuid, body: RichText): Promise<PhrasingRevisionRow> {
    const ownerId = currentOwnerId();
    const derived = deriveRevision(body);

    const [existing] = await db
      .select()
      .from(phrasingRevision)
      .where(
        and(
          eq(phrasingRevision.ownerId, ownerId),
          eq(phrasingRevision.phrasingId, phrasingId),
          eq(phrasingRevision.contentHash, derived.contentHash),
        ),
      )
      .limit(1);

    let revision = existing;
    if (revision === undefined) {
      [revision] = await db
        .insert(phrasingRevision)
        .values({ id: newUuid(), ownerId, phrasingId, ...derived })
        .returning();
      if (revision === undefined) {
        throw new Error("insert into phrasing_revision returned no row");
      }
    }

    // Deliberately not `updateOwned`: bumping the token here would make committing
    // text conflict with a rename it does not race.
    await db
      .update(phrasing)
      .set({ currentRevisionId: revision.id })
      .where(and(owned(phrasing), eq(phrasing.id, phrasingId)));

    return revision;
  }

  async function insertPhrasing(input: PhrasingInput): Promise<Phrasing> {
    const row = await insertOwned(db, phrasing, "phrasing", {
      id: input.id,
      phrasingSetId: input.phrasingSetId,
      variant: input.variant,
      label: input.label,
      sortKey: input.sortKey,
    });
    const revision = await append(input.id, input.body);
    return toPhrasing({ ...row, currentRevisionId: revision.id });
  }

  return {
    async listSets(options) {
      const rows = await db
        .select()
        .from(phrasingSet)
        .where(and(owned(phrasingSet), live(phrasingSet, options?.includeArchived)))
        .orderBy(asc(phrasingSet.id));
      return rows.map(toPhrasingSet);
    },

    async getSet(id) {
      return toPhrasingSet(await requireOwned<PhrasingSetRow>(db, phrasingSet, "phrasingSet", id));
    },

    // Each of the three references the next, so the canonical pointer is written
    // last, once there is something for it to point at (data-model.md #5).
    async createSet(input) {
      const ownerId = currentOwnerId();
      await db.insert(phrasingSet).values({ id: input.id, ownerId, purpose: input.purpose });
      await insertPhrasing({ ...input.phrasing, phrasingSetId: input.id });

      const [row] = await db
        .update(phrasingSet)
        .set({ canonicalPhrasingId: input.phrasing.id })
        .where(and(owned(phrasingSet), eq(phrasingSet.id, input.id)))
        .returning();
      if (row === undefined) {
        throw new Error("setting the canonical phrasing on phrasing_set matched no row");
      }
      return toPhrasingSet(row);
    },

    async updateSet(id, patch, expectedUpdatedAt) {
      return await setSet(id, expectedUpdatedAt, patch);
    },

    async archiveSet(id, expectedUpdatedAt) {
      return await setSet(id, expectedUpdatedAt, { archivedAt: new Date() });
    },

    async restoreSet(id, expectedUpdatedAt) {
      return await setSet(id, expectedUpdatedAt, { archivedAt: null });
    },

    async list(options) {
      const rows = await db
        .select()
        .from(phrasing)
        .where(
          and(
            owned(phrasing),
            options?.phrasingSetId === undefined
              ? undefined
              : eq(phrasing.phrasingSetId, options.phrasingSetId),
            live(phrasing, options?.includeArchived),
          ),
        )
        .orderBy(asc(phrasing.phrasingSetId), bySortKey(phrasing.sortKey));
      return rows.map(toPhrasing);
    },

    async get(id) {
      return toPhrasing(await requireOwned<PhrasingRow>(db, phrasing, "phrasing", id));
    },

    async create(input) {
      return await insertPhrasing(input);
    },

    async update(id, patch, expectedUpdatedAt) {
      return await setPhrasing(id, expectedUpdatedAt, patch);
    },

    async archive(id, expectedUpdatedAt) {
      return await setPhrasing(id, expectedUpdatedAt, { archivedAt: new Date() });
    },

    async restore(id, expectedUpdatedAt) {
      return await setPhrasing(id, expectedUpdatedAt, { archivedAt: null });
    },

    async addRevision(phrasingId, body) {
      await requireOwned<PhrasingRow>(db, phrasing, "phrasing", phrasingId);
      return toPhrasingRevision(await append(phrasingId, body));
    },

    // Two revisions can share a millisecond, so the id breaks the tie.
    // `currentOnly` joins through the pointer, so a phrasing with no revision yet
    // contributes nothing instead of a null.
    async listRevisions(options) {
      const base = db.select({ revision: phrasingRevision }).from(phrasingRevision);
      const selected = options?.currentOnly
        ? base.innerJoin(
            phrasing,
            and(
              eq(phrasing.ownerId, phrasingRevision.ownerId),
              eq(phrasing.currentRevisionId, phrasingRevision.id),
            ),
          )
        : base;

      const rows = await selected
        .where(
          and(
            eq(phrasingRevision.ownerId, currentOwnerId()),
            options?.phrasingId === undefined
              ? undefined
              : eq(phrasingRevision.phrasingId, options.phrasingId),
            // An empty list asks for nothing, which `inArray` cannot express.
            options?.ids === undefined
              ? undefined
              : options.ids.length === 0
                ? sql`false`
                : inArray(phrasingRevision.id, [...options.ids]),
          ),
        )
        .orderBy(
          asc(phrasingRevision.phrasingId),
          asc(phrasingRevision.createdAt),
          asc(phrasingRevision.id),
        );
      return rows.map((row) => toPhrasingRevision(row.revision));
    },
  };
}
