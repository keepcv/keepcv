import { ConcurrencyConflictError, NotFoundError, type ProfileRepository } from "@keepcv/core";
import {
  type ContactChannel,
  contactChannelSchema,
  type Profile,
  profileSchema,
  type Timestamp,
  type Uuid,
} from "@keepcv/schema";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import { contactChannel, profile } from "../schema/index.js";
import {
  type Changes,
  insertOwned,
  live,
  owned,
  requireOwned,
  standardDto,
  updateOwned,
} from "./owned-row.js";

type ProfileRow = typeof profile.$inferSelect;
type ContactChannelRow = typeof contactChannel.$inferSelect;

// Parsing rather than casting: this is the row -> DTO boundary, and a column
// that drifts from the contract - a widened CHECK, a dropped NOT NULL - should
// fail here rather than reach the wire.
function toProfile(row: ProfileRow): Profile {
  return profileSchema.parse({
    ...standardDto(row),
    fullName: row.fullName,
    pronouns: row.pronouns,
    headline: row.headline,
    location: row.location,
    summarySetId: row.summarySetId,
  });
}

function toContactChannel(row: ContactChannelRow): ContactChannel {
  return contactChannelSchema.parse({
    ...standardDto(row),
    kind: row.kind,
    label: row.label,
    value: row.value,
    isDefaultVisible: row.isDefaultVisible,
    sortKey: row.sortKey,
  });
}

export function createProfileRepository(db: Database): ProfileRepository {
  async function get(): Promise<Profile> {
    const ownerId = currentOwnerId();
    const [row] = await db.select().from(profile).where(eq(profile.ownerId, ownerId)).limit(1);
    if (row === undefined) {
      throw new NotFoundError("profile for owner", ownerId);
    }
    return toProfile(row);
  }

  async function setChannel(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<ContactChannelRow>,
  ): Promise<ContactChannel> {
    return toContactChannel(
      await updateOwned<ContactChannelRow>(
        db,
        contactChannel,
        "contactChannel",
        id,
        expectedUpdatedAt,
        changes,
      ),
    );
  }

  return {
    get,

    // The profile is the one table with no id in its key: there is exactly one
    // per owner, so the owner is the predicate and a miss can only be staleness.
    async update(patch, expectedUpdatedAt) {
      const [row] = await db
        .update(profile)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(owned(profile), eq(profile.updatedAt, new Date(expectedUpdatedAt))))
        .returning();
      if (row !== undefined) {
        return toProfile(row);
      }
      const current = await get();
      throw new ConcurrencyConflictError("profile", current.id, current.updatedAt);
    },

    async listContactChannels(options) {
      const rows = await db
        .select()
        .from(contactChannel)
        .where(and(owned(contactChannel), live(contactChannel, options?.includeArchived)))
        .orderBy(asc(contactChannel.sortKey));
      return rows.map(toContactChannel);
    },

    async getContactChannel(id) {
      return toContactChannel(
        await requireOwned<ContactChannelRow>(db, contactChannel, "contactChannel", id),
      );
    },

    async createContactChannel(input) {
      return toContactChannel(await insertOwned(db, contactChannel, "contactChannel", input));
    },

    async updateContactChannel(id, patch, expectedUpdatedAt) {
      return await setChannel(id, expectedUpdatedAt, patch);
    },

    async archiveContactChannel(id, expectedUpdatedAt) {
      return await setChannel(id, expectedUpdatedAt, { archivedAt: new Date() });
    },

    async restoreContactChannel(id, expectedUpdatedAt) {
      return await setChannel(id, expectedUpdatedAt, { archivedAt: null });
    },
  };
}
