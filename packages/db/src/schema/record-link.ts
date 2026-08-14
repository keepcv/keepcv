import { sql } from "drizzle-orm";
import { check, foreignKey, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { record } from "./career-record.js";
import { standardColumns } from "./owner.js";

// Repeated from `recordLinkKindSchema`; see the note in career-record.ts.
const KINDS = ["repo", "demo", "docs", "verify", "recording", "other"];

// One link table for every record kind rather than a `verification_url` here and
// a `recording_url` there. The dividing rule is in data-model.md #6: a URL is a
// link, a labelled value is a field.
export const recordLink = pgTable(
  "record_link",
  {
    ...standardColumns(),
    recordId: uuid("record_id").notNull(),
    kind: text("kind").notNull(),
    label: text("label"),
    url: text("url").notNull(),
    sortKey: text("sort_key").notNull(),
  },
  (table) => [
    check(
      "record_link_kind_check",
      sql.raw(`kind in (${KINDS.map((kind) => `'${kind}'`).join(", ")})`),
    ),
    uniqueIndex("record_link_sort_key_unique").on(table.recordId, table.sortKey),
    foreignKey({
      name: "record_link_record_fk",
      columns: [table.ownerId, table.recordId],
      foreignColumns: [record.ownerId, record.id],
    }).onDelete("cascade"),
  ],
);
