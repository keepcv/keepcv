import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  type ConstraintKind,
  ConstraintViolationError,
  newUuid,
  type UnitOfWork,
} from "@keepcv/core";
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

// Both drivers name the constraint on the cause, which is the only part worth
// carrying upwards.
const CONSTRAINT_KIND_BY_SQLSTATE: Record<string, ConstraintKind | undefined> = {
  "23505": "unique",
  "23503": "foreignKey",
  "23514": "check",
};

function asDomainError(error: unknown): unknown {
  const cause = (error as { cause?: { code?: string; constraint?: string } }).cause;
  const kind = CONSTRAINT_KIND_BY_SQLSTATE[cause?.code ?? ""];
  if (kind === undefined || cause?.constraint === undefined) {
    return error;
  }
  return new ConstraintViolationError(kind, cause.constraint, { cause: error });
}

// Every write runs inside a unit, so translating here covers repositories that
// do not exist yet.
function unitOfWork(db: Database): UnitOfWork {
  return {
    run: async (work) => {
      try {
        return await db.transaction(async (tx) => await work(createRepositories(tx)));
      } catch (error) {
        throw asDomainError(error);
      }
    },
  };
}

// Created with the owner rather than lazily: a missing profile is a broken
// store, which is easier to notice than a silent auto-create.
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

    // The look-up and the insert share a transaction, so a second caller cannot
    // mint a second owner.
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

    // Behind an advisory lock: drizzle's own bookkeeping table is not
    // concurrency safe, and two migrating processes fail on pg_type's unique
    // index.
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
