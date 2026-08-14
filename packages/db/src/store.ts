import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { newUuid, type UnitOfWork } from "@keepcv/core";
import { type Uuid, uuidSchema } from "@keepcv/schema";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePostgres } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";
import type { Database } from "./database.js";
import { createRepositories } from "./repositories/index.js";
import { owner, profile } from "./schema/index.js";

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../migrations", import.meta.url));

export interface Store {
  readonly unitOfWork: UnitOfWork;
  migrate(): Promise<void>;
  createOwner(id: Uuid): Promise<void>;
  close(): Promise<void>;
}

export interface LocalStore extends Store {
  ensureLocalOwner(): Promise<Uuid>;
}

function unitOfWork(db: Database): UnitOfWork {
  return {
    run: async (work) => await db.transaction(async (tx) => await work(createRepositories(tx))),
  };
}

// The profile is created with the owner rather than lazily on first read: every
// owner has exactly one, so a store where it is missing is broken, and that is a
// much easier thing to notice than a silent auto-create.
async function insertOwner(tx: Database, id: Uuid): Promise<void> {
  await tx.insert(owner).values({ id });
  await tx.insert(profile).values({ id: newUuid(), ownerId: id });
}

export function openLocalStore(options: { dataDir?: string } = {}): LocalStore {
  const client = options.dataDir === undefined ? new PGlite() : new PGlite(options.dataDir);
  const db = drizzlePglite(client);
  return {
    unitOfWork: unitOfWork(db),
    migrate: async () => await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    createOwner: async (id) => await db.transaction(async (tx) => await insertOwner(tx, id)),

    // Local mode holds exactly one owner (data-model.md #4), minted on first
    // launch and stable afterwards. The look-up and the insert share a
    // transaction so a second caller cannot mint a second one.
    ensureLocalOwner: async () =>
      await db.transaction(async (tx) => {
        const rows = await tx.select({ id: owner.id }).from(owner).limit(2);
        if (rows.length > 1) {
          throw new Error("a local store holds exactly one owner, and this one holds more");
        }
        const existing = rows[0];
        if (existing !== undefined) {
          return uuidSchema.parse(existing.id);
        }
        const id = newUuid();
        await insertOwner(tx, id);
        return id;
      }),

    close: async () => await client.close(),
  };
}

// Any constant; it only has to be the same one in every process that migrates.
const MIGRATION_LOCK = 4460371;

export function openServerStore(options: { connectionString: string }): Store {
  const pool = new Pool({ connectionString: options.connectionString });
  const db = drizzleNodePostgres(pool);
  return {
    unitOfWork: unitOfWork(db),

    // Behind an advisory lock, because two processes migrating one database at
    // once is normal - a rolling deploy, or the test suite running its files in
    // parallel - and drizzle's `create table if not exists` for its own
    // bookkeeping table is not safe against a concurrent one. It fails on
    // pg_type's unique index, which reads as nothing to do with migrations.
    migrate: async () => {
      const client = await pool.connect();
      try {
        await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK]);
        await migrateNodePostgres(db, { migrationsFolder: MIGRATIONS_FOLDER });
      } finally {
        await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK]);
        client.release();
      }
    },
    createOwner: async (id) => await db.transaction(async (tx) => await insertOwner(tx, id)),
    close: async () => await pool.end(),
  };
}
