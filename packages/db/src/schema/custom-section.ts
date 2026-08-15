import { pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { standardColumns } from "./owner.js";

// A heading the built-in kinds do not cover. The entries under it are ordinary
// `record` rows of kind `custom_entry`, so a custom row gets links, fields and
// points for free and templates never learn a second shape (data-model.md #6).
//
// The sections are one list per owner, which is the scope their sort key is
// unique in; the entries inside one are a list of their own (#3.5).
export const customSection = pgTable(
  "custom_section",
  {
    ...standardColumns(),
    heading: text("heading").notNull(),
    sortKey: text("sort_key").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    uniqueIndex("custom_section_sort_key_unique").on(table.ownerId, table.sortKey),
  ],
);
