import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organisation } from "./organisation.js";
import { standardColumns } from "./owner.js";
import { partialDate } from "./partial-date.js";

// Repeated from the schemas in @keepcv/schema rather than imported: drizzle-kit
// loads this file through a CJS require, which cannot resolve the package. The
// vocabulary drift test feeds both sides the same values.
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
];
const MODES = ["onsite", "hybrid", "remote"];
const SKILL_PROFICIENCIES = ["familiar", "working", "proficient", "expert"];

function quoted(values: string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}

// The columns a kind owns are null on every other kind. This is what keeps one
// table honest where eleven subtype tables would have used the type system: an
// education row cannot acquire a delivery mode.
function onlyOn(kind: string, columns: string[]) {
  return check(
    `record_${kind}_columns_check`,
    sql.raw(`kind = '${kind}' or (${columns.map((column) => `${column} is null`).join(" and ")})`),
  );
}

// One table for every record kind, not a supertype plus subtypes. The vocabulary
// in data-model.md #3.2 is identical across kinds, so it lives here; what is left
// is eleven kind-specific columns, scoped by CHECK. `title` is nullable and
// `is_current` defaults false, because a record can be saved half-entered and
// "this is missing an end date" is an observation the UI makes, not a constraint
// that blocks a save (data-model.md P-A).
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
    check("record_kind_check", sql.raw(`kind in (${quoted(KINDS)})`)),
    check("record_mode_check", sql.raw(`mode is null or mode in (${quoted(MODES)})`)),
    check(
      "record_proficiency_kinds_check",
      sql.raw(`kind in ('skill', 'language') or proficiency is null`),
    ),
    // Skill proficiency is a controlled vocabulary so "everything I am expert in"
    // is a query; language proficiency is free text, because "C1", "Native" and
    // "reading only" are all things people mean and we do not get to pick.
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

    // Records are dragged within their kind's list, so that is the scope the key
    // has to be unique in (data-model.md #3.5).
    uniqueIndex("record_sort_key_unique").on(table.ownerId, table.kind, table.sortKey),
    // The target of the composite key on record_link and record_field; see the
    // matching one on organisation.
    unique("record_owner_id_unique").on(table.ownerId, table.id),

    // Composite rather than a plain reference to organisation(id): it makes
    // pointing at another owner's organisation impossible rather than merely
    // untested. A null organisation_id satisfies it, which is the MATCH SIMPLE
    // behaviour we want.
    foreignKey({
      name: "record_organisation_fk",
      columns: [table.ownerId, table.organisationId],
      foreignColumns: [organisation.ownerId, organisation.id],
    }),
  ],
);
