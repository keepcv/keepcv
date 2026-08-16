import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { record } from "./career-record.js";
import { owner, standardColumns } from "./owner.js";
import { point } from "./point.js";

// A controlled vocabulary rather than free strings on each row, so renaming a
// tag is one write and merging two is an operation (data-model.md #8). `slug` is
// derived from the label by the repository, which is what stops "React" and
// "react" becoming two words for one thing.
export const tag = pgTable(
  "tag",
  {
    ...standardColumns(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    category: text("category"),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    // Partial, so archiving a tag frees its slug: a word taken by something the
    // user has put away is a word they cannot use.
    uniqueIndex("tag_slug_unique")
      .on(table.ownerId, table.slug)
      .where(sql`${table.archivedAt} is null`),
  ],
);

// Two join tables rather than one polymorphic one, so both sides keep a real
// foreign key. Neither carries standard columns beyond `owner_id`: the pair is
// the whole row, so untagging deletes rather than archives and destroys nothing
// the user wrote - both ends of it survive.
export const recordTag = pgTable(
  "record_tag",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owner.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull(),
    recordId: uuid("record_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.tagId, table.recordId] }),
    index("record_tag_record_idx").on(table.ownerId, table.recordId),
    foreignKey({
      name: "record_tag_tag_fk",
      columns: [table.ownerId, table.tagId],
      foreignColumns: [tag.ownerId, tag.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "record_tag_record_fk",
      columns: [table.ownerId, table.recordId],
      foreignColumns: [record.ownerId, record.id],
    }).onDelete("cascade"),
  ],
);

export const pointTag = pgTable(
  "point_tag",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owner.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull(),
    pointId: uuid("point_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.tagId, table.pointId] }),
    index("point_tag_point_idx").on(table.ownerId, table.pointId),
    foreignKey({
      name: "point_tag_tag_fk",
      columns: [table.ownerId, table.tagId],
      foreignColumns: [tag.ownerId, tag.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "point_tag_point_fk",
      columns: [table.ownerId, table.pointId],
      foreignColumns: [point.ownerId, point.id],
    }).onDelete("cascade"),
  ],
);
