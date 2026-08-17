import { sql } from "drizzle-orm";
import {
  char,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  type PgTableExtraConfigValue,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { instant, owner, standardColumns } from "./owner.js";
import { quoted } from "./vocabulary.js";

// One file, every extras callback annotated: these three reference each other in
// a cycle, and without the annotation TypeScript hits TS7022.

const PURPOSES = ["point", "profile_summary", "record_summary"];
const VARIANTS = ["standard", "short", "long", "angled"];

// `canonical_phrasing_id` is nullable so the set can be inserted before the
// phrasing that points back at it (data-model.md #5).
export const phrasingSet = pgTable(
  "phrasing_set",
  {
    ...standardColumns(),
    purpose: text("purpose").notNull(),
    canonicalPhrasingId: uuid("canonical_phrasing_id"),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    check("phrasing_set_purpose_check", sql.raw(`purpose in (${quoted(PURPOSES)})`)),

    // Carrying this set's own id makes "the canonical phrasing is mine" a foreign
    // key rather than a check nobody runs (I15).
    foreignKey({
      name: "phrasing_set_canonical_fk",
      columns: [table.ownerId, table.canonicalPhrasingId, table.id],
      foreignColumns: [phrasing.ownerId, phrasing.id, phrasing.phrasingSetId],
    }),
  ],
);

export const phrasing = pgTable(
  "phrasing",
  {
    ...standardColumns(),
    phrasingSetId: uuid("phrasing_set_id").notNull(),
    variant: text("variant").notNull(),
    label: text("label"),
    sortKey: text("sort_key").notNull(),
    currentRevisionId: uuid("current_revision_id"),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    check("phrasing_variant_check", sql.raw(`variant in (${quoted(VARIANTS)})`)),
    unique("phrasing_set_member_unique").on(table.ownerId, table.id, table.phrasingSetId),
    uniqueIndex("phrasing_sort_key_unique").on(table.ownerId, table.phrasingSetId, table.sortKey),
    index("phrasing_live_idx")
      .on(table.ownerId, table.phrasingSetId, table.sortKey)
      .where(sql`${table.archivedAt} is null`),
    foreignKey({
      name: "phrasing_set_fk",
      columns: [table.ownerId, table.phrasingSetId],
      foreignColumns: [phrasingSet.ownerId, phrasingSet.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "phrasing_current_revision_fk",
      columns: [table.ownerId, table.currentRevisionId, table.id],
      foreignColumns: [phrasingRevision.ownerId, phrasingRevision.id, phrasingRevision.phrasingId],
    }),
  ],
);

// IMMUTABLE: no `updated_at`, no `archived_at`, and a hand-written trigger in the
// migration rejects any update (data-model.md I2).
export const phrasingRevision = pgTable(
  "phrasing_revision",
  {
    id: uuid("id").notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owner.id, { onDelete: "cascade" }),
    phrasingId: uuid("phrasing_id").notNull(),
    body: jsonb("body").notNull(),
    plainText: text("plain_text").notNull(),
    charCount: integer("char_count").notNull(),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    unique("phrasing_revision_member_unique").on(table.ownerId, table.id, table.phrasingId),

    // Retyping a word and undoing it cannot pollute the history (I3).
    uniqueIndex("phrasing_revision_content_hash_unique").on(
      table.ownerId,
      table.phrasingId,
      table.contentHash,
    ),
    index("phrasing_revision_history_idx").on(table.ownerId, table.phrasingId, table.createdAt),
    foreignKey({
      name: "phrasing_revision_phrasing_fk",
      columns: [table.ownerId, table.phrasingId],
      foreignColumns: [phrasing.ownerId, phrasing.id],
    }).onDelete("cascade"),
  ],
);
