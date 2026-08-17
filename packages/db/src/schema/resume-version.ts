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
  uuid,
} from "drizzle-orm/pg-core";
import { instant, owner, standardColumns } from "./owner.js";
import { resume } from "./resume.js";
import { quoted } from "./vocabulary.js";

const TRIGGERS = ["export", "manual_save", "restore"];

const REF_KINDS = ["record", "point", "phrasing_revision", "contact_channel"];

// IMMUTABLE: no `updated_at`, no `archived_at`, and a hand-written trigger in the
// migration rejects any update (data-model.md I2).
export const resumeVersion = pgTable(
  "resume_version",
  {
    id: uuid("id").notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owner.id, { onDelete: "cascade" }),
    resumeId: uuid("resume_id").notNull(),
    seq: integer("seq").notNull(),
    trigger: text("trigger").notNull(),
    restoredFromVersionId: uuid("restored_from_version_id"),
    manifest: jsonb("manifest").notNull(),
    manifestHash: char("manifest_hash", { length: 64 }).notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    check("resume_version_trigger_check", sql.raw(`trigger in (${quoted(TRIGGERS)})`)),
    // The timeline reads on this index too: it is already (owner, resume, seq).
    unique("resume_version_seq_unique").on(table.ownerId, table.resumeId, table.seq),
    foreignKey({
      name: "resume_version_resume_fk",
      columns: [table.ownerId, table.resumeId],
      foreignColumns: [resume.ownerId, resume.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "resume_version_restored_from_fk",
      columns: [table.ownerId, table.restoredFromVersionId],
      foreignColumns: [table.ownerId, table.id],
    }),
  ],
);

export const resumeSnapshot = pgTable(
  "resume_snapshot",
  {
    ...standardColumns(),
    resumeVersionId: uuid("resume_version_id").notNull(),
    label: text("label").notNull(),
    note: text("note"),
    starredAt: instant("starred_at").notNull().defaultNow(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    unique("resume_snapshot_version_unique").on(table.ownerId, table.resumeVersionId),
    foreignKey({
      name: "resume_snapshot_version_fk",
      columns: [table.ownerId, table.resumeVersionId],
      foreignColumns: [resumeVersion.ownerId, resumeVersion.id],
    }).onDelete("cascade"),
  ],
);

// DERIVED from the manifests and rebuilt on import. Its parent is immutable, so
// unlike a search index it has nothing to drift from (data-model.md #9.2).
export const resumeContentRef = pgTable(
  "resume_content_ref",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owner.id, { onDelete: "cascade" }),
    resumeVersionId: uuid("resume_version_id").notNull(),
    refKind: text("ref_kind").notNull(),
    refId: uuid("ref_id").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ columns: [table.ownerId, table.resumeVersionId, table.refKind, table.refId] }),
    check("resume_content_ref_kind_check", sql.raw(`ref_kind in (${quoted(REF_KINDS)})`)),
    index("resume_content_ref_usage_idx").on(table.ownerId, table.refKind, table.refId),
    foreignKey({
      name: "resume_content_ref_version_fk",
      columns: [table.ownerId, table.resumeVersionId],
      foreignColumns: [resumeVersion.ownerId, resumeVersion.id],
    }).onDelete("cascade"),
  ],
);
