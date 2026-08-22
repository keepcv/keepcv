import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { standardColumns } from "./owner.js";
import { tag } from "./tag.js";
import { quoted } from "./vocabulary.js";

// Repeated rather than imported from @keepcv/schema: drizzle-kit loads this file
// through a CJS require and cannot resolve the package. A drift test feeds both
// sides the same values.
const SUBJECTS = ["record", "point"];
const SCOPES = ["exclude", "include", "only"];
const UNFINISHED = ["unplaced", "unmeasured"];
const KINDS = [
  "experience",
  "education",
  "project",
  "skill",
  "certification",
  "publication",
  "award",
  "language",
  "volunteering",
  "speaking",
  "custom_entry",
];

// A named narrowing of one of the two lists. Only what the store can answer:
// `unplaced` and `unmeasured` are facts about a point, not modes of a screen
// (data-model.md #8.1).
export const savedFilter = pgTable(
  "saved_filter",
  {
    ...standardColumns(),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    query: text("query").notNull().default(""),
    kind: text("kind"),
    tagId: uuid("tag_id"),
    archived: text("archived").notNull().default("exclude"),
    unfinished: text("unfinished"),
    sortKey: text("sort_key").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    uniqueIndex("saved_filter_sort_key_unique").on(table.ownerId, table.subject, table.sortKey),
    // `cascade` like every other reference to a tag, and never `set null`: the
    // key is composite, so Postgres would null `owner_id` with it. Nothing
    // deletes a tag anyway - archiving is the removal there is - so this can
    // only fire through the owner cascade.
    foreignKey({
      name: "saved_filter_tag_fk",
      columns: [table.ownerId, table.tagId],
      foreignColumns: [tag.ownerId, tag.id],
    }).onDelete("cascade"),
    check("saved_filter_subject_check", sql.raw(`subject in (${quoted(SUBJECTS)})`)),
    check("saved_filter_archived_check", sql.raw(`archived in (${quoted(SCOPES)})`)),
    check("saved_filter_kind_check", sql.raw(`kind is null or kind in (${quoted(KINDS)})`)),
    check(
      "saved_filter_unfinished_check",
      sql.raw(`unfinished is null or unfinished in (${quoted(UNFINISHED)})`),
    ),
    // A record has no `unplaced` and a point has no kind, so a row carrying the
    // other subject's narrowing would filter by something no list reads.
    check(
      "saved_filter_subject_columns_check",
      sql.raw(
        `(subject = 'record' and unfinished is null) or (subject = 'point' and kind is null)`,
      ),
    ),
  ],
);
