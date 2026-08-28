import {
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { owner, standardColumns } from "./owner.js";
import { tag } from "./tag.js";

// A named rule over the tag vocabulary: the words a role is hired for. Applying
// one places what carries them, so the rule is the whole of the row.
export const roleProfile = pgTable(
  "role_profile",
  {
    ...standardColumns(),
    name: text("name").notNull(),
    sortKey: text("sort_key").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    uniqueIndex("role_profile_sort_key_unique").on(table.ownerId, table.sortKey),
  ],
);

// The pair is the whole row, like `record_tag`, so taking a word out of a
// profile deletes rather than archives and destroys nothing the user wrote.
export const roleProfileTag = pgTable(
  "role_profile_tag",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owner.id, { onDelete: "cascade" }),
    roleProfileId: uuid("role_profile_id").notNull(),
    tagId: uuid("tag_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.roleProfileId, table.tagId] }),
    index("role_profile_tag_tag_idx").on(table.ownerId, table.tagId),
    foreignKey({
      name: "role_profile_tag_profile_fk",
      columns: [table.ownerId, table.roleProfileId],
      foreignColumns: [roleProfile.ownerId, roleProfile.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "role_profile_tag_tag_fk",
      columns: [table.ownerId, table.tagId],
      foreignColumns: [tag.ownerId, tag.id],
    }).onDelete("cascade"),
  ],
);
