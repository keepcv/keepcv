import type { CustomSectionRepository } from "@keepcv/core";
import { type CustomSection, customSectionSchema, type Timestamp, type Uuid } from "@keepcv/schema";
import { and } from "drizzle-orm";
import type { Database } from "../database.js";
import { customSection } from "../schema/index.js";
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

type CustomSectionRow = typeof customSection.$inferSelect;

function toCustomSection(row: CustomSectionRow): CustomSection {
  return customSectionSchema.parse({
    ...standardDto(row),
    heading: row.heading,
    sortKey: row.sortKey,
  });
}

export function createCustomSectionRepository(db: Database): CustomSectionRepository {
  async function set(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<CustomSectionRow>,
  ): Promise<CustomSection> {
    return toCustomSection(
      await updateOwned<CustomSectionRow>(
        db,
        customSection,
        "customSection",
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
        .from(customSection)
        .where(and(owned(customSection), live(customSection, options?.includeArchived)))
        .orderBy(bySortKey(customSection.sortKey));
      return rows.map(toCustomSection);
    },

    async get(id) {
      return toCustomSection(
        await requireOwned<CustomSectionRow>(db, customSection, "customSection", id),
      );
    },

    async create(input) {
      return toCustomSection(await insertOwned(db, customSection, "customSection", input));
    },

    async update(id, patch, expectedUpdatedAt) {
      return await set(id, expectedUpdatedAt, patch);
    },

    // The entries are not touched: cascading would make restoring the section
    // guess which of them the user had archived on their own.
    async archive(id, expectedUpdatedAt) {
      return await set(id, expectedUpdatedAt, { archivedAt: new Date() });
    },

    async restore(id, expectedUpdatedAt) {
      return await set(id, expectedUpdatedAt, { archivedAt: null });
    },
  };
}
