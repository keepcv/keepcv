import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

// A transaction handle satisfies this too, so a repository takes it and never
// learns whether it is inside one.
export type Database = PgDatabase<PgQueryResultHKT>;
