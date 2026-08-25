import { jsonb, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { standardColumns } from "./owner.js";

// The shipped designs are not rows: they exist in every build, so storing them
// would be one fact in two places. A resume names either by id.
export const template = pgTable(
  "template",
  {
    ...standardColumns(),
    name: text("name").notNull(),
    spec: jsonb("spec").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    uniqueIndex("template_name_unique").on(table.ownerId, table.name),
  ],
);
