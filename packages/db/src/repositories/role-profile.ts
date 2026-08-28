import type { RoleProfileRepository } from "@keepcv/core";
import {
  type RoleProfile,
  roleProfileSchema,
  roleProfileTagSchema,
  type Timestamp,
  type Uuid,
} from "@keepcv/schema";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import { roleProfile, roleProfileTag } from "../schema/index.js";
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

type RoleProfileRow = typeof roleProfile.$inferSelect;

function toRoleProfile(row: RoleProfileRow): RoleProfile {
  return roleProfileSchema.parse({
    ...standardDto(row),
    name: row.name,
    sortKey: row.sortKey,
  });
}

export function createRoleProfileRepository(db: Database): RoleProfileRepository {
  async function set(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<RoleProfileRow>,
  ): Promise<RoleProfile> {
    return toRoleProfile(
      await updateOwned<RoleProfileRow>(
        db,
        roleProfile,
        "roleProfile",
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
        .from(roleProfile)
        .where(and(owned(roleProfile), live(roleProfile, options?.includeArchived)))
        .orderBy(bySortKey(roleProfile.sortKey));
      return rows.map(toRoleProfile);
    },

    async get(id) {
      return toRoleProfile(await requireOwned<RoleProfileRow>(db, roleProfile, "roleProfile", id));
    },

    async create(input) {
      return toRoleProfile(await insertOwned(db, roleProfile, "roleProfile", input));
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

    async listTags(options) {
      const rows = await db
        .select()
        .from(roleProfileTag)
        .where(
          and(
            eq(roleProfileTag.ownerId, currentOwnerId()),
            options?.roleProfileId === undefined
              ? undefined
              : eq(roleProfileTag.roleProfileId, options.roleProfileId),
            options?.tagId === undefined ? undefined : eq(roleProfileTag.tagId, options.tagId),
          ),
        )
        .orderBy(asc(roleProfileTag.roleProfileId), asc(roleProfileTag.tagId));
      return rows.map((row) => roleProfileTagSchema.parse(row));
    },

    // Idempotent: the pair is the whole row. A tag that does not exist fails the
    // foreign key, which the API answers as 422.
    async addTag(roleProfileId, tagId) {
      await requireOwned<RoleProfileRow>(db, roleProfile, "roleProfile", roleProfileId);
      await db
        .insert(roleProfileTag)
        .values({ ownerId: currentOwnerId(), roleProfileId, tagId })
        .onConflictDoNothing();
      return roleProfileTagSchema.parse({ roleProfileId, tagId });
    },

    async removeTag(roleProfileId, tagId) {
      await requireOwned<RoleProfileRow>(db, roleProfile, "roleProfile", roleProfileId);
      await db
        .delete(roleProfileTag)
        .where(
          and(
            eq(roleProfileTag.ownerId, currentOwnerId()),
            eq(roleProfileTag.roleProfileId, roleProfileId),
            eq(roleProfileTag.tagId, tagId),
          ),
        );
    },
  };
}
