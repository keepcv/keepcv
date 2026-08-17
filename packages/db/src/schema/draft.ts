import { sql } from "drizzle-orm";
import { check, jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { instant, owner } from "./owner.js";
import { quoted } from "./vocabulary.js";

const TARGET_KINDS = ["phrasing", "record"];

// data-model.md #5. The target is the identity, so no id and no token; it is
// polymorphic, so the repository checks it exists rather than a foreign key (I18).
export const draft = pgTable(
  "draft",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owner.id, { onDelete: "cascade" }),
    targetKind: text("target_kind").notNull(),
    targetId: uuid("target_id").notNull(),
    field: text("field").notNull(),
    body: jsonb("body").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.targetKind, table.targetId, table.field] }),
    check("draft_target_kind_check", sql.raw(`target_kind in (${quoted(TARGET_KINDS)})`)),
  ],
);
