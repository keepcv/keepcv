import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Millisecond precision throughout, not the microseconds Postgres defaults to.
// `updated_at` is the optimistic-concurrency token (api-contract.md #2), so it
// travels to the client as an ISO string and comes back to be compared: at
// microsecond precision that comparison never matches, because a JavaScript
// Date cannot carry the digits it was given.
export function instant(name: string) {
  return timestamp(name, { withTimezone: true, precision: 3 });
}

// The tenancy anchor. Local mode holds exactly one row; when accounts land it
// gains a nullable link to Better Auth's user table and no other table changes.
export const owner = pgTable("owner", {
  id: uuid("id").primaryKey(),
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
  displayName: text("display_name"),
  lastOpenedAt: instant("last_opened_at"),
});

// data-model.md #3.1. Immutable tables omit `updated_at` and `archived_at`, so
// they do not use this.
export function standardColumns() {
  return {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owner.id, { onDelete: "cascade" }),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    archivedAt: instant("archived_at"),
  };
}
