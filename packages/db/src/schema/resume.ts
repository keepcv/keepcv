import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { record } from "./career-record.js";
import { contactChannel } from "./contact-channel.js";
import { customSection } from "./custom-section.js";
import { owner, standardColumns } from "./owner.js";
import { partialDate } from "./partial-date.js";
import { phrasing } from "./phrasing.js";
import { point } from "./point.js";
import { quoted } from "./vocabulary.js";

const SECTION_KINDS = [
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
  "custom",
];

const LAYOUTS = ["entries", "inline", "grouped"];

// data-model.md #9.1.
export const resume = pgTable(
  "resume",
  {
    ...standardColumns(),
    name: text("name").notNull(),
    targetCompany: text("target_company"),
    targetRole: text("target_role"),
    targetUrl: text("target_url"),
    targetJdText: text("target_jd_text"),
    appliedOn: partialDate("applied_on"),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.id] })],
);

export const resumeSection = pgTable(
  "resume_section",
  {
    ...standardColumns(),
    resumeId: uuid("resume_id").notNull(),
    kind: text("kind").notNull(),
    customSectionId: uuid("custom_section_id"),
    heading: text("heading"),
    layout: text("layout"),
    sortKey: text("sort_key").notNull(),
    isVisible: boolean("is_visible").notNull().default(true),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    // So a row below can reference this one together with the resume it is on.
    unique("resume_section_member_unique").on(table.ownerId, table.resumeId, table.id),
    check("resume_section_kind_check", sql.raw(`kind in (${quoted(SECTION_KINDS)})`)),
    check(
      "resume_section_layout_check",
      sql.raw(`layout is null or layout in (${quoted(LAYOUTS)})`),
    ),
    check(
      "resume_section_custom_check",
      sql.raw(`(kind = 'custom') = (custom_section_id is not null)`),
    ),
    unique("resume_section_sort_key_unique").on(table.ownerId, table.resumeId, table.sortKey),
    // NULLS NOT DISTINCT, so the rule reads on the kind alone but `custom`.
    unique("resume_section_kind_unique")
      .on(table.ownerId, table.resumeId, table.kind, table.customSectionId)
      .nullsNotDistinct(),
    foreignKey({
      name: "resume_section_resume_fk",
      columns: [table.ownerId, table.resumeId],
      foreignColumns: [resume.ownerId, resume.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "resume_section_custom_section_fk",
      columns: [table.ownerId, table.customSectionId],
      foreignColumns: [customSection.ownerId, customSection.id],
    }),
  ],
);

export const resumeEntry = pgTable(
  "resume_entry",
  {
    ...standardColumns(),
    resumeId: uuid("resume_id").notNull(),
    resumeSectionId: uuid("resume_section_id").notNull(),
    recordId: uuid("record_id").notNull(),
    sortKey: text("sort_key").notNull(),
    isVisible: boolean("is_visible").notNull().default(true),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    unique("resume_entry_member_unique").on(table.ownerId, table.resumeId, table.id),
    unique("resume_entry_record_unique").on(table.ownerId, table.resumeSectionId, table.recordId),
    unique("resume_entry_sort_key_unique").on(table.ownerId, table.resumeSectionId, table.sortKey),
    index("resume_entry_record_idx").on(table.ownerId, table.recordId),
    // I15: the resume id is in the reference, so a cross-resume section cannot
    // be named.
    foreignKey({
      name: "resume_entry_section_fk",
      columns: [table.ownerId, table.resumeId, table.resumeSectionId],
      foreignColumns: [resumeSection.ownerId, resumeSection.resumeId, resumeSection.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "resume_entry_record_fk",
      columns: [table.ownerId, table.recordId],
      foreignColumns: [record.ownerId, record.id],
    }),
  ],
);

export const resumeEntryPoint = pgTable(
  "resume_entry_point",
  {
    ...standardColumns(),
    resumeId: uuid("resume_id").notNull(),
    resumeEntryId: uuid("resume_entry_id").notNull(),
    pointId: uuid("point_id").notNull(),
    phrasingId: uuid("phrasing_id").notNull(),
    sortKey: text("sort_key").notNull(),
    isVisible: boolean("is_visible").notNull().default(true),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    // I13, which needs `resume_id` on this row to be an index at all.
    unique("resume_entry_point_unique").on(table.ownerId, table.resumeId, table.pointId),
    unique("resume_entry_point_sort_key_unique").on(
      table.ownerId,
      table.resumeEntryId,
      table.sortKey,
    ),
    index("resume_entry_point_point_idx").on(table.ownerId, table.pointId),
    foreignKey({
      name: "resume_entry_point_entry_fk",
      columns: [table.ownerId, table.resumeId, table.resumeEntryId],
      foreignColumns: [resumeEntry.ownerId, resumeEntry.resumeId, resumeEntry.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "resume_entry_point_point_fk",
      columns: [table.ownerId, table.pointId],
      foreignColumns: [point.ownerId, point.id],
    }),
    foreignKey({
      name: "resume_entry_point_phrasing_fk",
      columns: [table.ownerId, table.phrasingId],
      foreignColumns: [phrasing.ownerId, phrasing.id],
    }),
  ],
);

// An override: a channel with no row here uses its own `is_default_visible`.
export const resumeContactChannel = pgTable(
  "resume_contact_channel",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owner.id, { onDelete: "cascade" }),
    resumeId: uuid("resume_id").notNull(),
    contactChannelId: uuid("contact_channel_id").notNull(),
    isVisible: boolean("is_visible").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.resumeId, table.contactChannelId] }),
    foreignKey({
      name: "resume_contact_channel_resume_fk",
      columns: [table.ownerId, table.resumeId],
      foreignColumns: [resume.ownerId, resume.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "resume_contact_channel_channel_fk",
      columns: [table.ownerId, table.contactChannelId],
      foreignColumns: [contactChannel.ownerId, contactChannel.id],
    }).onDelete("cascade"),
  ],
);
