import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { standardColumns } from "./owner.js";
import { point } from "./point.js";
import { quoted } from "./vocabulary.js";

const KINDS = ["url", "note", "file"];

// PRIVATE and never rendered: `ResumeDocument` has no field it could travel in
// (I5). It is in the native export all the same, or I10 would not hold.
export const evidence = pgTable(
  "evidence",
  {
    ...standardColumns(),
    pointId: uuid("point_id").notNull(),
    kind: text("kind").notNull(),
    value: text("value").notNull(),
    note: text("note"),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    check("evidence_kind_check", sql.raw(`kind in (${quoted(KINDS)})`)),
    index("evidence_point_idx").on(table.ownerId, table.pointId),
    foreignKey({
      name: "evidence_point_fk",
      columns: [table.ownerId, table.pointId],
      foreignColumns: [point.ownerId, point.id],
    }).onDelete("cascade"),
  ],
);
