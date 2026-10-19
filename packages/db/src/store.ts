import { checkServerIdentity } from "node:tls";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  type CancellationSignal,
  type ConstraintKind,
  ConstraintViolationError,
  newUuid,
  type UnitOfWork,
} from "@keepcv/core";
import { type Uuid, uuidSchema } from "@keepcv/schema";
import { DrizzleQueryError, eq } from "drizzle-orm";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePostgres } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool, type PoolClient } from "pg";
import { parseIntoClientConfig } from "pg-connection-string";
import {
  acquire,
  CancellableClient,
  cancellableTransaction,
  checkCancellation,
  connectionSlots,
} from "./cancellation.js";
import type { Database } from "./database.js";
import { createRepositories } from "./repositories/index.js";
import { owner, profile } from "./schema/index.js";

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../migrations", import.meta.url));

export interface Store {
  readonly unitOfWork: UnitOfWork;
  migrate(): Promise<void>;
  createOwner(id: Uuid): Promise<void>;
  provisionOwner(id: Uuid): Promise<void>;
  eraseOwner(id: Uuid, confirmation: { erasePermanently: true }): Promise<void>;
  close(): Promise<void>;
}

export interface ServerStoreOptions {
  connectionString: string;
  max?: number;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  statement_timeout?: number;
  ssl?: { ca?: string };
}

export interface LocalStore extends Store {
  ensureLocalOwner(): Promise<Uuid>;
}

const CONSTRAINT_KIND_BY_SQLSTATE: Record<string, ConstraintKind | undefined> = {
  "23505": "unique",
  "23503": "foreignKey",
  "23514": "check",
};

function asDomainError(error: unknown): unknown {
  if (error === null || typeof error !== "object") return error;
  const cause = (error as { cause?: { code?: string; constraint?: string } }).cause;
  const kind = CONSTRAINT_KIND_BY_SQLSTATE[cause?.code ?? ""];
  if (kind === undefined || cause?.constraint === undefined) {
    return error;
  }
  return new ConstraintViolationError(kind, cause.constraint, { cause: error });
}

function unitOfWork(db: Database): UnitOfWork {
  return {
    run: async (work, options) => {
      checkCancellation(options?.signal);
      let failure: { error: unknown } | undefined;
      try {
        return await db.transaction(async (tx) => {
          try {
            checkCancellation(options?.signal);
            const result = await work(createRepositories(tx));
            checkCancellation(options?.signal);
            return result;
          } catch (error) {
            failure = { error };
            throw error;
          }
        });
      } catch (error) {
        throw asDomainError(failure === undefined ? error : failure.error);
      }
    },
  };
}

async function insertOwner(tx: Database, id: Uuid): Promise<void> {
  await tx.insert(owner).values({ id });
  await tx.insert(profile).values({ id: newUuid(), ownerId: id });
}

function confirmErasure(confirmation: { erasePermanently: true }): void {
  if (!Object.is(confirmation.erasePermanently, true))
    throw new TypeError("Owner erasure needs explicit permanent-erasure confirmation");
}

function ownerLifecycle(db: Database) {
  return {
    createOwner: async (id: Uuid) => await db.transaction(async (tx) => await insertOwner(tx, id)),
    provisionOwner: async (id: Uuid) => {
      await db.transaction(async (tx) => {
        await tx.insert(owner).values({ id }).onConflictDoNothing({ target: owner.id });
        await tx
          .insert(profile)
          .values({ id: newUuid(), ownerId: id })
          .onConflictDoNothing({ target: profile.ownerId });
      });
    },
    eraseOwner: async (id: Uuid, confirmation: { erasePermanently: true }) => {
      confirmErasure(confirmation);
      await db.transaction(async (tx) => {
        await tx.delete(owner).where(eq(owner.id, id));
      });
    },
  };
}

export function openLocalStore(options: { dataDir?: string } = {}): LocalStore {
  const client = options.dataDir === undefined ? new PGlite() : new PGlite(options.dataDir);
  const db = drizzlePglite(client);
  let closing: Promise<void> | undefined;
  return {
    unitOfWork: unitOfWork(db),
    migrate: async () => await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    ...ownerLifecycle(db),

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

    close: () => (closing ??= client.close()),
  };
}

const MIGRATION_LOCK = 4460371;

function validateServerOptions(options: ServerStoreOptions): void {
  for (const [name, value] of Object.entries({
    max: options.max,
    connectionTimeoutMillis: options.connectionTimeoutMillis,
    idleTimeoutMillis: options.idleTimeoutMillis,
    statement_timeout: options.statement_timeout,
  })) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < (name === "max" ? 1 : 0)))
      throw new RangeError(
        `${name} must be a ${name === "max" ? "positive" : "non-negative"} safe integer`,
      );
  }
  if (options.ssl !== undefined) {
    const query = new URL(options.connectionString).searchParams;
    if (["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert"].some((key) => query.has(key)))
      throw new TypeError("Use ssl options or connection-string SSL parameters, not both");
  }
}

async function withServerConnection<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
  signal?: CancellationSignal,
): Promise<T> {
  const client = await acquire(pool, signal);
  let disconnected: Error | undefined;
  let failed = true;
  const onError = (error: Error) => {
    disconnected ??= error;
  };
  client.on("error", onError);
  try {
    const result = await work(client);
    if (disconnected !== undefined) throw disconnected;
    failed = signal?.aborted ?? false;
    return result;
  } catch (error) {
    if (signal === undefined && disconnected !== undefined && error instanceof DrizzleQueryError) {
      const code = (error.cause as { code?: string } | undefined)?.code;
      if (code === undefined || code === "57P01" || code.startsWith("08")) throw disconnected;
    }
    throw error;
  } finally {
    client.release(failed);
    client.removeListener("error", onError);
  }
}

export function openServerStore(options: ServerStoreOptions): Store {
  validateServerOptions(options);
  const { connectionString, ssl: explicitSsl, ...limits } = options;
  const config = parseIntoClientConfig(connectionString);
  const ssl =
    explicitSsl === undefined
      ? (config.ssl ??
        (["prefer", "require", "verify-ca", "verify-full"].includes(process.env["PGSSLMODE"] ?? "")
          ? true
          : undefined))
      : { ...explicitSsl, rejectUnauthorized: true };
  const host = config.host || process.env["PGHOST"] || "localhost";
  const pool = new Pool({
    Client: CancellableClient,
    ...limits,
    ...config,
    ...(ssl === undefined || ssl === false
      ? {}
      : {
          ssl: {
            ...(ssl === true ? {} : ssl),
            // node-postgres omits servername for IPs, which verified localhost instead.
            checkServerIdentity: (_hostname, certificate) => checkServerIdentity(host, certificate),
          },
        }),
  });
  // An idle backend disconnect otherwise becomes an unhandled pool error.
  pool.on("error", () => undefined);
  const slot = connectionSlots(pool.options.max, pool.options.connectionTimeoutMillis ?? 0);
  const connection = async <T>(
    work: (client: PoolClient) => Promise<T>,
    signal?: CancellationSignal,
  ) => {
    const release = await slot(signal);
    try {
      return await withServerConnection(pool, work, signal);
    } finally {
      release();
    }
  };
  const connected = <T>(work: (db: Database) => Promise<T>) =>
    connection(async (client) => await work(drizzleNodePostgres(client)));
  let closing: Promise<void> | undefined;
  return {
    unitOfWork: {
      run: async (work, options) => {
        const signal = options?.signal;
        try {
          return await connection(
            async (client) =>
              signal === undefined
                ? await unitOfWork(drizzleNodePostgres(client)).run(work)
                : await cancellableTransaction(
                    pool,
                    client,
                    signal,
                    async (db) => await work(createRepositories(db)),
                  ),
            signal,
          );
        } catch (error) {
          throw asDomainError(error);
        }
      },
    },

    // Concurrent migrators collided on pg_type before this advisory lock.
    migrate: async () =>
      await connection(async (client) => {
        await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK]);
        try {
          await migrateNodePostgres(drizzleNodePostgres(client), {
            migrationsFolder: MIGRATIONS_FOLDER,
          });
        } finally {
          await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK]);
        }
      }),
    createOwner: async (id) =>
      await connected(async (db) => await ownerLifecycle(db).createOwner(id)),
    provisionOwner: async (id) =>
      await connected(async (db) => await ownerLifecycle(db).provisionOwner(id)),
    eraseOwner: async (id, confirmation) => {
      confirmErasure(confirmation);
      await connected(async (db) => await ownerLifecycle(db).eraseOwner(id, confirmation));
    },
    close: () => (closing ??= pool.end()),
  };
}
