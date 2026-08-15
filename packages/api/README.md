# @keepcv/api

The HTTP boundary for [KeepCV](https://github.com/keepcv/keepcv): Hono routes,
Zod validation, RFC 9457 `problem+json` errors, a generated OpenAPI document and
a typed client.

This is a first-class artifact rather than an emitted side effect. It is the
boundary a self-hosted deployment talks to and the one a hosted adapter
implements, so it is designed, versioned and stable - which framework-internal
RPC would not be.

> **Status: early development.** The public API is unstable and there is no
> release yet. Today it serves the whole record store - the profile, contact
> channels, organisations, custom sections, records, points, phrasings and
> everything hanging off them - plus the boot payload and the native export and
> import. Tags, search, resumes and versions follow.

## Installation

```sh
pnpm add @keepcv/api
```

## Usage

The package builds an app; it does not open a store, choose a port or decide who
the caller is. Those belong to whatever is hosting it - locally that is the
`keepcv` launcher.

```ts
import { createApi, sessionTokenAuth } from "@keepcv/api";
import { openLocalStore, runAsOwner } from "@keepcv/db";

const store = openLocalStore({ dataDir: "./keepcv-data" });
await store.migrate();
const ownerId = await store.ensureLocalOwner();

const api = createApi({
  unitOfWork: store.unitOfWork,
  runAsOwner,
  authenticate: sessionTokenAuth(process.env.KEEPCV_TOKEN, ownerId),
});

// api.fetch is a standard fetch handler: serve it with @hono/node-server,
// or hand it straight to a runtime that speaks Request and Response.
```

The typed client resolves the route types inside this package, so a consumer
does not re-infer them:

```ts
import { createClient } from "@keepcv/api";

const client = createClient("http://127.0.0.1:4319", { sessionToken });
const response = await client.v1.profile.$get();
```

## What the boundary guarantees

- **The owner is never a parameter.** `authenticate` resolves a request to an
  owner and the API enters that scope once; every repository call underneath is
  scoped by construction, so "forgot to scope this query" is not a mistake a
  handler is able to make.
- **Every error is a typed problem.** One shape, `application/problem+json`,
  with a `type` the client switches on. Nothing downstream parses prose.
- **A stale write answers with the state the server holds.** Mutations carry the
  `updated_at` they were based on - as `{ expectedUpdatedAt, patch }`, beside the
  changes rather than among them - and a mismatch returns `409` with the current
  row attached, so the UI can show both sides instead of discarding one.
- **A refused write names the constraint.** A taken sort key is a `409`, because
  the caller resolves it by re-reading; a parent that does not exist, or a column
  the record's kind may not carry, is a `422`. A driver error never reaches the
  client, since a caller mistake reported as `500` sends everybody looking in the
  wrong place.
- **`DELETE` archives.** Nothing the user wrote is destroyed, the row stays
  readable by id, and `?archived=include` brings it back into a list.
- **Phrasing text is append-only.** `PATCH /v1/phrasings/{id}` has no field that
  could carry text; changing what a phrasing says is
  `POST /v1/phrasings/{id}/revisions`, which keeps the superseded wording and
  moves a pointer. It is the one write with no concurrency token, because two
  people writing different wordings at once must both keep their text.
- **One request boots a client.** `GET /v1/store` answers the whole store,
  archived rows included, so filters and counts are selectors over cached data
  rather than requests. It carries the wording each phrasing says now and not the
  ones it used to; `GET /v1/export` carries every wording ever written.
- **Export is never gated.** Not by an account, not by a licence, not by any
  entitlement state.
- **The OpenAPI document comes from the same Zod schemas** that validate the
  requests, so the description and the validator cannot disagree. It is served
  at `/v1/openapi.json`, without a token, because tooling fetches it before it
  has one.

## Licence

MIT
