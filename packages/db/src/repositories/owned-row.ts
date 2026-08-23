import { ConcurrencyConflictError, NotFoundError } from "@keepcv/core";
import type { Timestamp, Uuid } from "@keepcv/schema";
import { and, eq, isNull, type SQL, sql } from "drizzle-orm";
import type { PgColumn, PgInsertValue, PgTable } from "drizzle-orm/pg-core";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";

// Drizzle's builders cannot infer a row type through a generic table parameter,
// so the table is loosely typed and the row type comes from the caller.
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

// Sort keys order by code unit, and a database initialised under a locale
// collation puts a key in the upper-case magnitude last.
export function bySortKey(column: PgColumn): SQL {
  return sql`${column} collate "C" asc`;
}

export function toTimestamp(value: Date): Timestamp {
  return value.toISOString() as Timestamp;
}

// `phrasing_revision` is immutable and has neither, so it does not use this.
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

// Drizzle drops undefined from a `set`, which is what makes a sparse patch
// work. `updatedAt` is always present, so a patch of nothing is still a valid
// statement.
export type Changes<Row> = { [Column in keyof Row]?: Row[Column] | undefined };

export function owned(table: OwnedTable) {
  return eq(table.ownerId, currentOwnerId());
}

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

// Generic in the table, unlike the read helpers, so the row type comes back
// inferred. The cast is only for re-adding `ownerId`.
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

// A miss is one of two very different things: a 404 is a dead link, a 409 is
// two edits racing and needs the user to compare.
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
