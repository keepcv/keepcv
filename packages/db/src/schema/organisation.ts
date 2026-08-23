import { sql } from "drizzle-orm";
import { check, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { standardColumns } from "./owner.js";
import { quoted } from "./vocabulary.js";

const KINDS = ["company", "institution", "issuer", "publisher", "venue", "other"];

export const organisation = pgTable(
  "organisation",
  {
    ...standardColumns(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    website: text("website"),
    industry: text("industry"),
    location: text("location"),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    check("organisation_kind_check", sql.raw(`kind in (${quoted(KINDS)})`)),
  ],
);
