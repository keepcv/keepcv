import { foreignKey, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { standardColumns } from "./owner.js";
import { phrasingSet } from "./phrasing.js";

// Everything but the standard columns is nullable: a profile can be saved half-
// entered.
export const profile = pgTable(
  "profile",
  {
    ...standardColumns(),
    fullName: text("full_name"),
    pronouns: text("pronouns"),
    headline: text("headline"),
    location: text("location"),
    summarySetId: uuid("summary_set_id"),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    uniqueIndex("profile_owner_unique").on(table.ownerId),
    foreignKey({
      name: "profile_summary_set_fk",
      columns: [table.ownerId, table.summarySetId],
      foreignColumns: [phrasingSet.ownerId, phrasingSet.id],
    }),
  ],
);
