import { is } from "drizzle-orm";
import type { PgInsertValue, PgTable } from "drizzle-orm/pg-core";
import { PgliteDatabase, PgliteTransaction } from "drizzle-orm/pglite";
import type { Database } from "../database.js";

export async function insertAll<T extends PgTable>(
  db: Database,
  table: T,
  values: PgInsertValue<T>[],
): Promise<void> {
  if (values.length === 0) return;
  const query = db.insert(table).values(values);
  // PGlite 0.5.4 returns empty results above 32,767 bind parameters.
  const budget = is(db, PgliteDatabase) || is(db, PgliteTransaction) ? 32_767 : 65_535;
  if (query.toSQL().params.length <= budget) {
    await query;
    return;
  }
  if (values.length === 1)
    throw new RangeError("One imported row exceeds the database parameter budget");
  const middle = Math.floor(values.length / 2);
  await insertAll(db, table, values.slice(0, middle));
  await insertAll(db, table, values.slice(middle));
}
