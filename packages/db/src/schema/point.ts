import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { record } from "./career-record.js";
import { owner, standardColumns } from "./owner.js";
import { partialDate } from "./partial-date.js";
import { phrasingSet } from "./phrasing.js";
import { quoted } from "./vocabulary.js";

const CONFIDENCES = ["verified", "estimated", "unverified"];

// The atomic content unit, attachable to a record of any kind. `record_id` is
// nullable so a point can be captured before it is decided where it belongs
// (data-model.md P-A); `phrasing_set_id` is not, because a point with no words
// in it is not a state worth being able to reach.
export const point = pgTable(
  "point",
  {
    ...standardColumns(),
    recordId: uuid("record_id"),
    phrasingSetId: uuid("phrasing_set_id").notNull(),
    confidence: text("confidence").notNull().default("unverified"),
    occurredOn: partialDate("occurred_on"),
    sortKey: text("sort_key").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    check("point_confidence_check", sql.raw(`confidence in (${quoted(CONFIDENCES)})`)),

    // NULLS NOT DISTINCT, because the points nobody has placed yet are a list the
    // user drags within like any other. With the default, every one of them would
    // sit in a scope of its own and I11 would hold there vacuously.
    unique("point_sort_key_unique")
      .on(table.ownerId, table.recordId, table.sortKey)
      .nullsNotDistinct(),
    index("point_live_idx")
      .on(table.ownerId, table.recordId, table.sortKey)
      .where(sql`${table.archivedAt} is null`),

    foreignKey({
      name: "point_record_fk",
      columns: [table.ownerId, table.recordId],
      foreignColumns: [record.ownerId, record.id],
    }),
    foreignKey({
      name: "point_phrasing_set_fk",
      columns: [table.ownerId, table.phrasingSetId],
      foreignColumns: [phrasingSet.ownerId, phrasingSet.id],
    }),
  ],
);

// Secondary associations, N:N. A pure many-to-many model cannot answer "under
// which heading does this print", which every renderer needs, and a single
// foreign key cannot express work spanning a role and a side project: the
// primary parent decides placement, these drive discovery and selection.
//
// No standard columns and so no `archived_at`. The row carries nothing of its
// own, so unlinking destroys nothing - both ends of it survive.
export const pointRecordLink = pgTable(
  "point_record_link",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owner.id, { onDelete: "cascade" }),
    pointId: uuid("point_id").notNull(),
    recordId: uuid("record_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.pointId, table.recordId] }),
    index("point_record_link_record_idx").on(table.ownerId, table.recordId),
    foreignKey({
      name: "point_record_link_point_fk",
      columns: [table.ownerId, table.pointId],
      foreignColumns: [point.ownerId, point.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "point_record_link_record_fk",
      columns: [table.ownerId, table.recordId],
      foreignColumns: [record.ownerId, record.id],
    }).onDelete("cascade"),
  ],
);
