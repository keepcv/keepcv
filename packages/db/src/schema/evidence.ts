import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { standardColumns } from "./owner.js";
import { point } from "./point.js";
import { quoted } from "./vocabulary.js";

const KINDS = ["url", "note", "file"];

// PRIVATE, and never rendered. The exclusion is structural rather than a filter
// somebody has to remember: `ResumeDocument` has no field this could travel in
// (I5). It is in the native export in full all the same - "private" means never
// printed, not withheld from the user, and I10 would not hold otherwise.
//
// Unordered, so no sort key: evidence backs a point up rather than reading as a
// list.
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
