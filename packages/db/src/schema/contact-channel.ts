import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { standardColumns } from "./owner.js";

// A `text` column with a CHECK rather than a Postgres enum type, because a CHECK
// can be narrowed as well as widened by an ordinary migration and an enum cannot
// drop a value without a type rewrite (data-model.md #3.3).
//
// Repeated from `contactChannelKindSchema` rather than interpolated: drizzle-kit
// loads this file through a CJS require, which cannot resolve @keepcv/schema.
// A test inserts every declared kind and one undeclared one, so the two lists
// cannot drift silently.
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
    check(
      "contact_channel_kind_check",
      sql.raw(`kind in (${KINDS.map((k) => `'${k}'`).join(", ")})`),
    ),
    uniqueIndex("contact_channel_sort_key_unique").on(table.ownerId, table.sortKey),
    index("contact_channel_live_idx")
      .on(table.ownerId, table.sortKey)
      .where(sql`${table.archivedAt} is null`),
  ],
);
