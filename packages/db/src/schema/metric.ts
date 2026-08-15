import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  foreignKey,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { standardColumns } from "./owner.js";
import { point } from "./point.js";
import { quoted } from "./vocabulary.js";

const DIRECTIONS = ["increase", "decrease", "neutral"];

// Numbers kept as numbers rather than buried in the wording, so "everything where
// I moved a percentage" is a query rather than a memory exercise. `double
// precision` and not `numeric`: the only writer is a JavaScript number, and a
// column that holds exactly the values the DTO can express cannot drift from it.
export const metric = pgTable(
  "metric",
  {
    ...standardColumns(),
    pointId: uuid("point_id").notNull(),
    label: text("label").notNull(),
    value: doublePrecision("value").notNull(),
    unit: text("unit"),
    baseline: doublePrecision("baseline"),
    direction: text("direction"),
    period: text("period"),
    sortKey: text("sort_key").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    check(
      "metric_direction_check",
      sql.raw(`direction is null or direction in (${quoted(DIRECTIONS)})`),
    ),
    uniqueIndex("metric_sort_key_unique").on(table.ownerId, table.pointId, table.sortKey),
    foreignKey({
      name: "metric_point_fk",
      columns: [table.ownerId, table.pointId],
      foreignColumns: [point.ownerId, point.id],
    }).onDelete("cascade"),
  ],
);
