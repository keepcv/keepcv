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

// `record_id` is nullable so a point can be captured before it is placed;
// `phrasing_set_id` is not, because a point with no words is not a state.
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

    // NULLS NOT DISTINCT: unplaced points are one list the user drags within,
    // and with the default each would sit in a scope of its own and I11 hold
    // vacuously.
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

// The primary parent decides placement; these drive discovery and selection. No
// `archived_at`: the row carries nothing of its own, so unlinking destroys
// nothing.
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
