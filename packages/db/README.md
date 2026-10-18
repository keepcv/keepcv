# @keepcv/db

PostgreSQL persistence for [KeepCV](https://github.com/keepcv/keepcv): the
Drizzle schema, the migrations, and the implementations of the repository port
defined in `@keepcv/core`.

PostgreSQL is the only dialect. Locally that is **PGlite** - real PostgreSQL
compiled to WebAssembly, running in-process with no Docker and no daemon -
and on a server it is an ordinary PostgreSQL. One schema, one migration set, one set of
queries, so there is no dialect drift to manage.

> **Status: early development.** The public API is unstable and there is no
> release yet. The whole record store is here - profile, organisations, records,
> custom sections, points, phrasings, tags, drafts and the native export - the
> composition a resume is, and its history: versions, snapshots, comparison,
> restore and the usage index.

## Installation

```sh
pnpm add @keepcv/db
```

## Usage

```ts
import { openLocalStore, runAsOwner } from "@keepcv/db";

const store = openLocalStore({ dataDir: "./keepcv-data" });
await store.migrate();

const ownerId = await store.ensureLocalOwner();

await runAsOwner(ownerId, async () => {
  await store.unitOfWork.run(async (repositories) => {
    const profile = await repositories.profile.get();
    await repositories.profile.update({ fullName: "Ada Lovelace" }, profile.updatedAt);
  });
});
```

Omit `dataDir` for an in-memory store, which is what the tests use.

`openServerStore({ connectionString })` returns the same thing over a
node-postgres pool, minus `ensureLocalOwner`.

### Cancelling a unit

```ts
await runAsOwner(ownerId, () =>
  store.unitOfWork.run(async (repositories) => {
    await repositories.store.load(archive);
  }, { signal: request.signal }),
);
```

`UnitOfWorkOptions` and its structural `CancellationSignal` type are exported
by `@keepcv/core`. Native Node and browser `AbortSignal` objects satisfy the
contract. Options are optional; existing callers retain their defaults. Pass a
deadline signal or a signal combining a deadline and transport disconnect when
the whole operation should stop. A statement timeout alone limits each SQL
statement, not an entire callback.

An already-aborted unit runs no callback or authored statement. On server
PostgreSQL, cancellation removes queued acquisition waits, interrupts connection
startup, prevents subsequent statements and requests cancellation of the actual
checked-out backend. Cleanup rolls back the unit before disposing of its client.
A control connection authenticates as the configured database identity and calls
`pg_cancel_backend` for that backend; it is outside the work pool's `max` and is
closed after the request. Its acquisition uses the configured nonzero connection
timeout, or five seconds; its statement and response limits are five seconds.
If cancellation transport fails, the work connection is closed. A disconnected
or unacknowledged cleanup cannot establish that server work has stopped.

During work, the first observed callback error or cancellation wins. Cancellation
rejects with `signal.reason`. Rollback failure cannot replace that error. A
callback is never replayed. It may continue non-database work after cancellation,
but later statements on its expired unit are refused. Cancellation cannot
preempt synchronous JavaScript; callbacks doing long computation must yield.

Once COMMIT is dispatched to the driver, abort is ignored for that unit. A confirmed commit succeeds;
a lost reply rejects and may still mean the write committed. Re-read before
retrying authored work. An abort error does not prove rollback if the connection
or cleanup was lost. After the unit settles, a late abort cannot cancel later
work on a reused connection.

Each `run` starts its own transaction. A nested call does not join the outer
unit or inherit its signal; pass the same signal explicitly to cancel both and
allow enough pool slots. Catching cancellation inside a callback cannot make
the cancelled transaction commit. Migrate, provision, erase and close retain
their explicit lifecycle and do not inherit a request signal.

PGlite observes the signal before entry, before the callback and before commit.
It does not interrupt an in-process statement or pending caller code, so its
rollback waits for the callback to settle.

### Large native archives

`repositories.store.load(archive)` retains its empty-store requirement and
restores native ids, all historical Revisions, canonical phrasings and current
Revision pointers. Every INSERT is bounded by the actual emitted parameter count
at PostgreSQL's 65,535-parameter limit, or PGlite 0.5.4's effective 32,767
limit, including the derived usage index. All
batches and tables stay in the same owner-scoped transaction. A later failure
leaves the original empty profile and no partially imported data. No native
format or database migration is needed.

### Owner lifecycle

Use `await store.provisionOwner(ownerId)` with a stable UUID when provisioning
may be retried. Concurrent calls converge on one owner and one profile in a
transaction. Existing content is preserved; a missing placeholder profile is
repaired. `createOwner(ownerId)` remains a strict create that refuses duplicates.

Permanent erasure is `await store.eraseOwner(ownerId, { erasePermanently: true })`.
It deletes the owner and all owned data atomically, including archived rows,
evidence, drafts and history. Missing owners are already erased. The caller
obtains explicit confirmation and stops admitting work for that owner first.
This operation is outside editing repositories and is not an API route. It
does not erase caller-held exports or backups; the caller manages those files.
Provisioning an erased id creates a fresh store.

### Server connections

```ts
const store = openServerStore({
  connectionString,
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 10000,
  ssl: { ca: trustedCaPem },
});
try {
  await store.migrate();
  // Run owner-scoped units here.
} finally {
  await store.close();
}
```

`max` is a positive integer. Timeout values are non-negative integer
milliseconds; zero disables the timeout. Omitted values keep the driver's
defaults. The connection timeout covers connection setup and waiting for a
free pool slot. The statement timeout runs on PostgreSQL, which cancels the
statement and rolls its unit back. Closing waits for checked-out work to finish
and shares its completion promise across retries; it does not cancel a stuck
callback. Bound statements and finish callbacks before shutdown.

The pool handles idle connection errors locally and retires the broken client.
It writes no default diagnostics, credentials, authored values or driver/client
objects. A later operation obtains a new connection on demand; there is no
background reconnect loop or process-wide error handler. Checked-out connections
also have an error listener through migration, lifecycle and unit-of-work calls.
A disconnected or refused unit releases its client for disposal and rejects.
The transaction stays on that one connection and is never continued on a
replacement.

The adapter never replays a transaction automatically. If PostgreSQL commits
but the reply is lost, the operation rejects even though its changes may have
landed. Re-read the store before deciding whether to retry authored work.
Acquisition and statement limits above apply during recovery too; configure
them for bounded database work. PostgreSQL enforces the statement deadline;
it does not put a deadline on caller code inside a unit. Close retains its
listener while active work drains and repeated calls share one promise.

Explicit `ssl` enables certificate and hostname validation. Omit `ca` to use
Node's trusted roots. Alternatively use a connection string with
`sslmode=verify-full` and `sslrootcert`. Do not combine explicit SSL options with
`ssl`, `sslmode`, `sslcert`, `sslkey` or `sslrootcert` in the URL: node-postgres
would overwrite the supplied SSL configuration, so the adapter refuses that
combination. Without explicit `ssl`, the driver's connection-string and
environment behavior applies. Certificate validation checks the configured
hostname or IP, including when the driver omits TLS servername for an IP.
Connection-string parsing uses the driver's parser before adding this check,
so URL SSL parameters cannot overwrite it. Explicitly disabling certificate
validation in a URL or environment remains an insecure driver option. See
[node-postgres TLS](https://node-postgres.com/features/ssl)
and [pool configuration](https://node-postgres.com/apis/pool).

Migrations and their advisory lock share one connection, so a pool of one works.
Use a migration identity with DDL rights and an appropriately restricted runtime
identity. The adapter installs no RLS policies; isolation remains the owner
predicates tested by the repository suite.

### Two rules the API shape enforces

**No repository method takes an owner id.** Scope comes from `runAsOwner`, so
"forgot to scope this query" is not a mistake a caller is able to make. Calling
a repository outside the scope throws rather than reading across owners.

**A repository is only reachable inside `unitOfWork.run`.** Creating a point
will write five tables and resolve two circular foreign keys; a partial failure
there leaves a point with no text, so there is no non-transactional path to
take by accident.

### Concurrency

Mutations carry the `updatedAt` they were based on. A mismatch throws
`ConcurrencyConflictError` carrying the timestamp the row actually has, so the
caller can re-read and show a comparison. Neither side is dropped silently.

### Append-only tables

`phrasing_revision` and `resume_version` are never updated. Both are held that
way by a trigger written by hand at the end of the migration that creates them,
because a rule living only in the repository is one stray `set` away from
rewriting what a version claims was sent.

### Archive, never delete

Reads exclude archived rows unless you pass `{ includeArchived: true }`.
Archiving keeps the row and everything on it; genuine erasure is a separate,
explicitly confirmed operation.

## Migrations

Migrations are generated from the Drizzle schema and reviewed as SQL:

```sh
pnpm --filter @keepcv/db db:generate
```

They are **forward-only** and follow expand/contract: add, backfill, switch,
and only drop the old shape in a later release. A step that destroys data in
the same release that stops using it does not merge. CI regenerates and fails
if the schema and the migrations disagree.

## Tests

The contract suite runs against every implementation of the port and asserts
the data model's invariants rather than the queries, so an implementation that
diverges fails loudly instead of subtly.

```sh
pnpm --filter @keepcv/db test                      # PGlite only
DATABASE_URL=postgres://... pnpm --filter @keepcv/db test   # and server Postgres
```

Use only a disposable synthetic database for the server tests. Configuration
tests install temporary refusal triggers and exercise TLS through a local
PostgreSQL protocol proxy using public test certificates. They verify trust,
hostname checks, pool limits, acquisition/startup/statement timeouts, idle
eviction, idle and checked-out disconnects, outage recovery, lost COMMIT replies,
owner isolation, migration locking, provisioning recovery and shutdown. Release
validation exercises idle and active disconnects in an isolated process using
the installed tarball and requires empty default diagnostics. In CI the
server URL is required, so these tests cannot silently skip that coverage.

The [installed reliability fixture](../../fixtures/editor-consumer/src/postgresql-reliability.test.ts)
is also a public-entry reproducer: it creates and exports 2000 and 3000 Points
with three Revisions each, imports each archive concurrently for two owners,
checks all ids and pointers, and interrupts an API Request at an observed
PostgreSQL lock barrier. `pnpm release:check` installs the packed packages into
a fresh consumer outside the checkout and runs it with `DATABASE_URL`. The
source suites additionally test every loader table at its parameter boundary,
later-batch rollback, callback cancellation and COMMIT acknowledgment races.

## Licence

MIT - see [LICENSE](LICENSE).
