import type { SavedFilterRepository } from "@keepcv/core";
import { type SavedFilter, savedFilterSchema, type Timestamp, type Uuid } from "@keepcv/schema";
import { and, eq } from "drizzle-orm";
import type { Database } from "../database.js";
import { savedFilter } from "../schema/index.js";
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

type SavedFilterRow = typeof savedFilter.$inferSelect;

function toSavedFilter(row: SavedFilterRow): SavedFilter {
  return savedFilterSchema.parse({
    ...standardDto(row),
    name: row.name,
    subject: row.subject,
    query: row.query,
    kind: row.kind,
    tagId: row.tagId,
    archived: row.archived,
    unfinished: row.unfinished,
    sortKey: row.sortKey,
  });
}

export function createSavedFilterRepository(db: Database): SavedFilterRepository {
  async function set(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<SavedFilterRow>,
  ): Promise<SavedFilter> {
    return toSavedFilter(
      await updateOwned<SavedFilterRow>(
        db,
        savedFilter,
        "savedFilter",
        id,
        expectedUpdatedAt,
        changes,
      ),
    );
  }

  return {
    async list(options) {
      const rows = await db
        .select()
        .from(savedFilter)
        .where(
          and(
            owned(savedFilter),
            live(savedFilter, options?.includeArchived),
            options?.subject === undefined ? undefined : eq(savedFilter.subject, options.subject),
          ),
        )
        // By subject first: the sort key is scoped to `(owner_id, subject)`, so
        // two subjects can hold the same key and the key alone is not a total
        // order. The export round trip is what found that.
        .orderBy(savedFilter.subject, bySortKey(savedFilter.sortKey));
      return rows.map(toSavedFilter);
    },

    async get(id) {
      return toSavedFilter(await requireOwned<SavedFilterRow>(db, savedFilter, "savedFilter", id));
    },

    async create(input) {
      return toSavedFilter(await insertOwned(db, savedFilter, "savedFilter", input));
    },

    async update(id, patch, expectedUpdatedAt) {
      return await set(id, expectedUpdatedAt, patch);
    },

    async archive(id, expectedUpdatedAt) {
      return await set(id, expectedUpdatedAt, { archivedAt: new Date() });
    },

    async restore(id, expectedUpdatedAt) {
      return await set(id, expectedUpdatedAt, { archivedAt: null });
    },
  };
}
