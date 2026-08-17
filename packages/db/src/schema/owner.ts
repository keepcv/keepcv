import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Milliseconds, not the microseconds Postgres defaults to: a JavaScript Date
// cannot carry them, so every second write would look like a conflict.
export function instant(name: string) {
  return timestamp(name, { withTimezone: true, precision: 3 });
}

export const owner = pgTable("owner", {
  id: uuid("id").primaryKey(),
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
  displayName: text("display_name"),
  lastOpenedAt: instant("last_opened_at"),
});

// data-model.md #3.1. Each table declares the `(owner_id, id)` primary key
// itself: identity is owner-scoped, so restoring an export never collides.
export function standardColumns() {
  return {
    id: uuid("id").notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owner.id, { onDelete: "cascade" }),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    archivedAt: instant("archived_at"),
  };
}
