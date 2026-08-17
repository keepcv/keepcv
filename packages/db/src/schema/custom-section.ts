import { pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { standardColumns } from "./owner.js";

// The entries under it are `record` rows of kind `custom_entry`, not rows here
// (data-model.md #6).
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
