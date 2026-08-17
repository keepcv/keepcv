import { sql } from "drizzle-orm";
import { check, jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { instant, owner } from "./owner.js";
import { quoted } from "./vocabulary.js";

const TARGET_KINDS = ["phrasing", "record"];

// Uncommitted editor state (data-model.md #5). Revisions are meaningful moments,
// so keystrokes must not create them - and in a product whose promise is that
// nothing written is lost, losing in-progress text to a closed tab is the
// founding failure in miniature.
//
// The target is the identity: there is no second draft of one field, so there is
// no id, and no `archived_at` either - a draft is discarded once its text is a
// revision or the user has explicitly abandoned it. `updated_at` is not a
// concurrency token here; the next keystroke is meant to overwrite this row.
//
// The target carries no foreign key, unlike every other reference in the store:
// its vocabulary is open, `resume` joins it, and a draft left pointing at
// nothing is inert rather than wrong. The repository checks the target exists on
// write instead.
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
