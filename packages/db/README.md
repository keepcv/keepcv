# @keepcv/db

PostgreSQL persistence for [KeepCV](https://github.com/keepcv/keepcv): the
Drizzle schema, the migrations, and the implementations of the repository port
defined in `@keepcv/core`.

PostgreSQL is the only dialect. Locally that is **PGlite** - real PostgreSQL
compiled to WebAssembly, running in-process with no Docker and no daemon -
and hosted it is a server PostgreSQL. One schema, one migration set, one set of
queries, so there is no dialect drift to manage.

> **Status: early development.** The public API is unstable and there is no
> release yet. The whole record store is here - profile, organisations, records,
> custom sections, points, phrasings, tags and the native export; resumes and
> versions follow.

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
node-postgres pool, minus `ensureLocalOwner` - hosted deployments create owners
when accounts are created, not when the process starts.

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

## Licence

MIT - see [LICENSE](LICENSE).
