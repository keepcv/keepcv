import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { record } from "./career-record.js";
import { standardColumns } from "./owner.js";

// Repeated from `recordFieldValueKindSchema`; see the note in career-record.ts.
const VALUE_KINDS = ["text", "url", "date", "number"];

// `key` is what a specialised template addresses (template-model.md #3).
export const recordField = pgTable(
  "record_field",
  {
    ...standardColumns(),
    recordId: uuid("record_id").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
    valueKind: text("value_kind").notNull().default("text"),
    sortKey: text("sort_key").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    check(
      "record_field_value_kind_check",
      sql.raw(`value_kind in (${VALUE_KINDS.map((kind) => `'${kind}'`).join(", ")})`),
    ),
    // Owner-scoped: record ids repeat across owners once a store is imported.
    uniqueIndex("record_field_key_unique").on(table.ownerId, table.recordId, table.key),
    uniqueIndex("record_field_sort_key_unique").on(table.ownerId, table.recordId, table.sortKey),
    foreignKey({
      name: "record_field_record_fk",
      columns: [table.ownerId, table.recordId],
      foreignColumns: [record.ownerId, record.id],
    }).onDelete("cascade"),
  ],
);
