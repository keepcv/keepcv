import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { standardColumns } from "./owner.js";
import { quoted } from "./vocabulary.js";

// A CHECK rather than a Postgres enum: an enum cannot drop a value without a
// type rewrite (data-model.md #3.3). Every vocabulary in this schema follows it.
const KINDS = [
  "email",
  "phone",
  "website",
  "linkedin",
  "github",
  "scholar",
  "orcid",
  "location",
  "other",
];

export const contactChannel = pgTable(
  "contact_channel",
  {
    ...standardColumns(),
    kind: text("kind").notNull(),
    label: text("label"),
    value: text("value").notNull(),
    isDefaultVisible: boolean("is_default_visible").notNull().default(true),
    sortKey: text("sort_key").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    check("contact_channel_kind_check", sql.raw(`kind in (${quoted(KINDS)})`)),
    uniqueIndex("contact_channel_sort_key_unique").on(table.ownerId, table.sortKey),
    index("contact_channel_live_idx")
      .on(table.ownerId, table.sortKey)
      .where(sql`${table.archivedAt} is null`),
  ],
);
