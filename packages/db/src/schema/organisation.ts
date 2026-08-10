import { sql } from "drizzle-orm";
import { check, pgTable, text, unique } from "drizzle-orm/pg-core";
import { standardColumns } from "./owner.js";

// Repeated from `organisationKindSchema` rather than imported: drizzle-kit loads
// this file through a CJS require, which cannot resolve @keepcv/schema. The
// vocabulary drift test feeds both lists the same values.
const KINDS = ["company", "institution", "issuer", "publisher", "venue", "other"];

// First-class rather than a string on each record, because two roles at one
// company is common and every well-made resume groups them under one heading
// (data-model.md #6). `name` is the one thing you always know when creating one,
// so it is the single NOT NULL the principle allows.
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
    check("organisation_kind_check", sql.raw(`kind in (${KINDS.map((k) => `'${k}'`).join(", ")})`)),
    // Redundant against the primary key, and there to be the target of the
    // composite foreign key on `record`: that is what stops a record pointing at
    // another owner's organisation. A constraint rather than an index so it is
    // declared inside CREATE TABLE, before the migration adds the key to it.
    unique("organisation_owner_id_unique").on(table.ownerId, table.id),
  ],
);
