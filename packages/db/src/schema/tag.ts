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

// `slug` is derived from the label by the repository (data-model.md I17).
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
    // Partial, so archiving a tag frees its slug.
    uniqueIndex("tag_slug_unique")
      .on(table.ownerId, table.slug)
      .where(sql`${table.archivedAt} is null`),
  ],
);

// Two tables rather than one polymorphic one, so both sides keep a real foreign
// key. The pair is the whole row, so untagging deletes rather than archives.
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
