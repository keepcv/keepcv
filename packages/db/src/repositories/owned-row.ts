import { ConcurrencyConflictError, NotFoundError } from "@keepcv/core";
import type { Timestamp, Uuid } from "@keepcv/schema";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import type { PgColumn, PgInsertValue, PgTable } from "drizzle-orm/pg-core";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";

// Any table built from `standardColumns()`, and the part of any of its rows that
// these helpers touch. Drizzle's builders cannot infer a row type through a
// generic table parameter, so the table is loosely typed here and the row type
// comes from the caller instead - which is where it is known anyway.
export type OwnedTable = PgTable & {
  id: PgColumn;
  ownerId: PgColumn;
  updatedAt: PgColumn;
  archivedAt: PgColumn;
};

export interface OwnedRow {
  id: string;
  updatedAt: Date;
}

export function toTimestamp(value: Date): Timestamp {
  return value.toISOString() as Timestamp;
}

// The four columns every owned table shares, converted once so ten mappers do
// not each spell out the archived_at ternary. `phrasing_revision` is immutable
// and has neither `updated_at` nor `archived_at`, so it does not use this.
export function standardDto(row: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}) {
  return {
    id: row.id,
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
    archivedAt: row.archivedAt === null ? null : toTimestamp(row.archivedAt),
  };
}

// An absent key leaves the column alone; an explicit null clears it. Drizzle
// drops undefined values from a `set`, which is what makes a sparse patch work,
// and `updatedAt` is always present so a patch of nothing is still a valid
// statement rather than an empty one.
export type Changes<Row> = { [Column in keyof Row]?: Row[Column] | undefined };

export function owned(table: OwnedTable) {
  return eq(table.ownerId, currentOwnerId());
}

// Reads filter archived rows out by default (api-contract.md #4). Including them
// is an explicit option, never the default.
export function live(table: OwnedTable, includeArchived: boolean | undefined): SQL | undefined {
  return includeArchived === true ? undefined : isNull(table.archivedAt);
}

export async function findOwned<Row extends OwnedRow>(
  db: Database,
  table: OwnedTable,
  id: Uuid,
): Promise<Row | undefined> {
  const [row] = await db
    .select()
    .from(table)
    .where(and(owned(table), eq(table.id, id)))
    .limit(1);
  return row as Row | undefined;
}

export async function requireOwned<Row extends OwnedRow>(
  db: Database,
  table: OwnedTable,
  entity: string,
  id: Uuid,
): Promise<Row> {
  const row = await findOwned<Row>(db, table, id);
  if (row === undefined) {
    throw new NotFoundError(entity, id);
  }
  return row;
}

// The owner comes from ambient scope rather than the values, which is what makes
// inserting into somebody else's store impossible rather than merely untested.
// Unlike the read helpers this stays generic in the table, so the row type comes
// back inferred and the caller needs no cast; only re-adding `ownerId` to the
// narrowed values needs one, since TypeScript cannot see that it reconstitutes
// the full insert type.
export async function insertOwned<T extends OwnedTable>(
  db: Database,
  table: T,
  entity: string,
  values: Omit<PgInsertValue<T>, "ownerId">,
): Promise<T["$inferSelect"]> {
  const [row] = await db
    .insert(table)
    .values({ ...values, ownerId: currentOwnerId() } as PgInsertValue<T>)
    .returning();
  if (row === undefined) {
    throw new Error(`insert into ${entity} returned no row`);
  }
  return row;
}

// One update path for every owner-scoped table, so they cannot disagree about
// what a failed write means. A miss is one of two very different things and the
// caller has to tell them apart: a 404 is a dead link, a 409 is two edits racing
// and needs the user to compare rather than one side being dropped silently.
export async function updateOwned<Row extends OwnedRow>(
  db: Database,
  table: OwnedTable,
  entity: string,
  id: Uuid,
  expectedUpdatedAt: Timestamp,
  changes: Changes<Row>,
): Promise<Row> {
  const [row] = await db
    .update(table)
    .set({ ...changes, updatedAt: new Date() })
    .where(and(owned(table), eq(table.id, id), eq(table.updatedAt, new Date(expectedUpdatedAt))))
    .returning();
  if (row !== undefined) {
    return row as Row;
  }

  const current = await requireOwned<Row>(db, table, entity, id);
  throw new ConcurrencyConflictError(entity, id, toTimestamp(current.updatedAt));
}
