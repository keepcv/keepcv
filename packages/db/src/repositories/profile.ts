import { ConcurrencyConflictError, NotFoundError, type ProfileRepository } from "@keepcv/core";
import {
  type ContactChannel,
  contactChannelSchema,
  type Profile,
  profileSchema,
  type Timestamp,
  type Uuid,
} from "@keepcv/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import { contactChannel, profile } from "../schema/index.js";

type ProfileRow = typeof profile.$inferSelect;
type ContactChannelRow = typeof contactChannel.$inferSelect;

function toTimestamp(value: Date): Timestamp {
  return value.toISOString() as Timestamp;
}

// Parsing rather than casting: this is the row -> DTO boundary, and a column
// that drifts from the contract - a widened CHECK, a dropped NOT NULL - should
// fail here rather than reach the wire.
function toProfile(row: ProfileRow): Profile {
  return profileSchema.parse({
    id: row.id,
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
    archivedAt: row.archivedAt === null ? null : toTimestamp(row.archivedAt),
    fullName: row.fullName,
    pronouns: row.pronouns,
    headline: row.headline,
    location: row.location,
  });
}

function toContactChannel(row: ContactChannelRow): ContactChannel {
  return contactChannelSchema.parse({
    id: row.id,
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
    archivedAt: row.archivedAt === null ? null : toTimestamp(row.archivedAt),
    kind: row.kind,
    label: row.label,
    value: row.value,
    isDefaultVisible: row.isDefaultVisible,
    sortKey: row.sortKey,
  });
}

// An absent key leaves the column alone; an explicit null clears it. Drizzle
// drops undefined values from a `set`, which is what makes a sparse patch work,
// and `updatedAt` is always present so a patch of nothing is still a valid
// statement rather than an empty one.
type Changes<Row> = { [Column in keyof Row]?: Row[Column] | undefined };

export function createProfileRepository(db: Database): ProfileRepository {
  async function get(): Promise<Profile> {
    const ownerId = currentOwnerId();
    const [row] = await db.select().from(profile).where(eq(profile.ownerId, ownerId)).limit(1);
    if (row === undefined) {
      throw new NotFoundError("profile for owner", ownerId);
    }
    return toProfile(row);
  }

  // A miss means one of two very different things, and the caller has to be
  // able to tell them apart: a 404 is a dead link, a 409 is two edits racing and
  // needs the user to compare rather than one side to be dropped silently.
  async function rejectChannelWrite(id: Uuid): Promise<never> {
    const [row] = await db
      .select({ updatedAt: contactChannel.updatedAt })
      .from(contactChannel)
      .where(and(eq(contactChannel.ownerId, currentOwnerId()), eq(contactChannel.id, id)))
      .limit(1);
    if (row === undefined) {
      throw new NotFoundError("contactChannel", id);
    }
    throw new ConcurrencyConflictError("contactChannel", id, toTimestamp(row.updatedAt));
  }

  async function setChannel(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<ContactChannelRow>,
  ): Promise<ContactChannel> {
    const [row] = await db
      .update(contactChannel)
      .set({ ...changes, updatedAt: new Date() })
      .where(
        and(
          eq(contactChannel.ownerId, currentOwnerId()),
          eq(contactChannel.id, id),
          eq(contactChannel.updatedAt, new Date(expectedUpdatedAt)),
        ),
      )
      .returning();
    return row === undefined ? await rejectChannelWrite(id) : toContactChannel(row);
  }

  return {
    get,

    async update(patch, expectedUpdatedAt) {
      const [row] = await db
        .update(profile)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(
            eq(profile.ownerId, currentOwnerId()),
            eq(profile.updatedAt, new Date(expectedUpdatedAt)),
          ),
        )
        .returning();
      if (row !== undefined) {
        return toProfile(row);
      }
      const current = await get();
      throw new ConcurrencyConflictError("profile", current.id, current.updatedAt);
    },

    async listContactChannels(options) {
      const owned = eq(contactChannel.ownerId, currentOwnerId());
      const rows = await db
        .select()
        .from(contactChannel)
        .where(
          options?.includeArchived === true ? owned : and(owned, isNull(contactChannel.archivedAt)),
        )
        .orderBy(asc(contactChannel.sortKey));
      return rows.map(toContactChannel);
    },

    async createContactChannel(input) {
      const [row] = await db
        .insert(contactChannel)
        .values({ ...input, ownerId: currentOwnerId() })
        .returning();
      if (row === undefined) {
        throw new Error("insert into contact_channel returned no row");
      }
      return toContactChannel(row);
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
