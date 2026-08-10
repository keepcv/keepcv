import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

// PGlite and node-postgres share this base, which is why there is one schema,
// one migration set and one set of queries for both (data-model.md: PostgreSQL
// is the only dialect). A transaction handle satisfies it too, so repositories
// take it and never learn whether they are inside one.
export type Database = PgDatabase<PgQueryResultHKT>;
