import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { customSection } from "./custom-section.js";
import { organisation } from "./organisation.js";
import { standardColumns } from "./owner.js";
import { partialDate } from "./partial-date.js";
import { phrasingSet } from "./phrasing.js";
import { quoted } from "./vocabulary.js";

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
const MODES = ["onsite", "hybrid", "remote"];
const SKILL_PROFICIENCIES = ["familiar", "working", "proficient", "expert"];

// What keeps one table honest where subtype tables would use the type system:
// an education row cannot acquire a delivery mode.
function onlyOn(kind: string, columns: string[]) {
  return check(
    `record_${kind}_columns_check`,
    sql.raw(`kind = '${kind}' or (${columns.map((column) => `${column} is null`).join(" and ")})`),
  );
}

// One table for every record kind (data-model.md #6). `title` is nullable and
// `is_current` defaults false: a record can be saved half-entered.
export const record = pgTable(
  "record",
  {
    ...standardColumns(),
    kind: text("kind").notNull(),

    title: text("title"),
    subtitle: text("subtitle"),
    organisationId: uuid("organisation_id"),
    startedOn: partialDate("started_on"),
    endedOn: partialDate("ended_on"),
    isCurrent: boolean("is_current").notNull().default(false),
    location: text("location"),
    sortKey: text("sort_key").notNull(),
    summarySetId: uuid("summary_set_id"),
    customSectionId: uuid("custom_section_id"),

    employmentType: text("employment_type"),
    mode: text("mode"),
    grade: text("grade"),
    gradeScale: text("grade_scale"),
    thesisTitle: text("thesis_title"),
    honours: text("honours"),
    category: text("category"),
    proficiency: text("proficiency"),
    credentialId: text("credential_id"),
    expiresOn: partialDate("expires_on"),
    doi: text("doi"),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    check("record_kind_check", sql.raw(`kind in (${quoted(KINDS)})`)),
    check("record_mode_check", sql.raw(`mode is null or mode in (${quoted(MODES)})`)),
    check(
      "record_proficiency_kinds_check",
      sql.raw(`kind in ('skill', 'language') or proficiency is null`),
    ),
    // Skill proficiency is a vocabulary; language proficiency is free text.
    check(
      "record_skill_proficiency_check",
      sql.raw(
        `kind <> 'skill' or proficiency is null or proficiency in (${quoted(SKILL_PROFICIENCIES)})`,
      ),
    ),
    onlyOn("experience", ["employment_type", "mode"]),
    onlyOn("education", ["grade", "grade_scale", "thesis_title", "honours"]),
    onlyOn("skill", ["category"]),
    onlyOn("certification", ["credential_id", "expires_on"]),
    onlyOn("publication", ["doi"]),

    // Both directions, where `onlyOn` gives one.
    check(
      "record_custom_section_check",
      sql.raw(`(kind = 'custom_entry') = (custom_section_id is not null)`),
    ),

    // NULLS NOT DISTINCT covers both scopes: the column is null on every kind but
    // custom_entry, where nulls comparing equal collapses this to (owner, kind).
    unique("record_sort_key_unique")
      .on(table.ownerId, table.kind, table.customSectionId, table.sortKey)
      .nullsNotDistinct(),

    // Composite, so pointing at another owner's organisation is impossible rather
    // than merely untested. A null satisfies it, which is MATCH SIMPLE.
    foreignKey({
      name: "record_organisation_fk",
      columns: [table.ownerId, table.organisationId],
      foreignColumns: [organisation.ownerId, organisation.id],
    }),
    foreignKey({
      name: "record_summary_set_fk",
      columns: [table.ownerId, table.summarySetId],
      foreignColumns: [phrasingSet.ownerId, phrasingSet.id],
    }),
    foreignKey({
      name: "record_custom_section_fk",
      columns: [table.ownerId, table.customSectionId],
      foreignColumns: [customSection.ownerId, customSection.id],
    }),
  ],
);
