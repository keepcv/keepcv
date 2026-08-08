# API Contract

> The boundary between `apps/web` and `@keepcv/api`, and — more importantly —
> the boundary the private cloud repo implements.
> Companion: [`data-model.md`](data-model.md),
> [`application-structure.md`](application-structure.md).

---

## 1. Why this is a first-class artifact

The public/private split works only if the private cloud repo can be a thin
adapter rather than a fork. That requires a boundary that is documented,
versioned and stable — which framework-internal RPC would not give us, and
which self-hosters genuinely need.

So the HTTP API is designed, not emitted as a side effect.

---

## 2. Conventions

**Versioning.** All routes are under `/v1/`. Self-hosted deployments routinely
run mismatched client and server builds; that is the normal state of
self-hosted software.

**Transport.** JSON over HTTP. Request and response bodies are validated
against the same Zod schemas the client uses. An OpenAPI document
is generated from those schemas and served at `/v1/openapi.json`.

**Errors.** RFC 9457 `application/problem+json`, always:

```jsonc
{
  "type": "https://keepcv.app/problems/validation-failed",
  "title": "Validation failed",
  "status": 422,
  "detail": "phrasing.body: link nesting exceeds maximum depth",
  "instance": "/v1/phrasings/019...",
  "errors": [{ "path": "body[0].c[0].href", "code": "invalid_scheme" }]
}
```

The client renders typed problems. No string parsing, ever.

**Concurrency.** Mutations carry the `updated_at` they were based on, as
`If-Unmodified-Since`-style semantics in the body. A mismatch returns `409`
*with the current server state*, so the UI can present a comparison rather
than discarding one side silently.

**Idempotency.** Creates accept a client-generated UUIDv7 as the resource id,
so a retried create is naturally idempotent — no idempotency-key header
needed.

**Partial updates.** `PATCH` with a sparse body. Absent means unchanged; an
explicit `null` clears. This distinction is load-bearing given how many
nullable fields the model has by design (data-model.md P-A).

**Pagination.** Cursor-based on `(sort_key, id)` or `(updated_at, id)`.
UUIDv7's time ordering makes the cursor stable. Most endpoints will never
paginate in practice, but the shape is fixed now so it never becomes breaking.

**Archive vs purge.** `DELETE` archives. Purging is
`POST /v1/{resource}/{id}/purge` with explicit confirmation — deliberately not
reachable by an accidental `DELETE`.

**Authentication.** Local mode: the per-launch session token in a custom
header. Hosted: Better Auth session. Route handlers see an ambient owner scope
either way and never accept an owner id from the caller.

---

## 3. Resources

```
GET    /v1/store                       whole-store boot payload — CURRENT state only
GET    /v1/store/summary               counts, recent activity, nudges

GET    /v1/profile                     PATCH /v1/profile
CRUD   /v1/contact-channels
CRUD   /v1/organisations

CRUD   /v1/records                     ?kind=&tag=&archived=&q=
GET    /v1/records/:id
POST   /v1/records/:id/move            { sortKey }

CRUD   /v1/records/:id/links           uniform, any record kind
CRUD   /v1/records/:id/fields          uniform, any record kind

CRUD   /v1/points                      ?recordId=&tag=&confidence=
POST   /v1/points/:id/move
GET    /v1/points/:id/usage            which resume versions reference it
CRUD   /v1/points/:id/metrics
CRUD   /v1/points/:id/evidence         never included in any render path

GET    /v1/phrasing-sets/:id
POST   /v1/phrasing-sets/:id/phrasings
PATCH  /v1/phrasings/:id               label, variant, sortKey — not text
POST   /v1/phrasings/:id/revisions     append; the only way text changes
GET    /v1/phrasings/:id/revisions     history
POST   /v1/phrasing-sets/:id/canonical { phrasingId }

PUT    /v1/drafts/:targetKind/:targetId/:field
DELETE /v1/drafts/:targetKind/:targetId/:field

CRUD   /v1/tags
POST   /v1/tags/:id/merge              { intoTagId }
GET    /v1/search                      ?q=&kind=&tag=&mode=fulltext|prefix

CRUD   /v1/resumes
GET    /v1/resumes/:id/composition     sections, entries, points
PATCH  /v1/resumes/:id/sections/:sid            heading, layout, visibility, sortKey
PATCH  /v1/resumes/:id/entries/:eid             visibility, sortKey
PATCH  /v1/resumes/:id/entries/:eid/points/:pid phrasingId, visibility, sortKey
GET    /v1/resumes/:id/document        compiled ResumeDocument (server-side)

GET    /v1/resumes/:id/versions
POST   /v1/resumes/:id/versions        { trigger }  — commits open drafts first
GET    /v1/resumes/:id/versions/:vid
GET    /v1/resumes/:id/versions/diff   ?a=&b=
POST   /v1/resumes/:id/versions/:vid/restore
POST   /v1/resumes/:id/versions/:vid/snapshot   { label, note }

POST   /v1/render                      ResumeDocument -> PDF/HTML
POST   /v1/lint                        ResumeDocument -> lint report

GET    /v1/export                      ?format=native|jsonresume|...
POST   /v1/import                      returns a reconciliation plan, not a result
POST   /v1/import/:planId/apply

GET    /v1/backup/status               mirror location, last written
POST   /v1/backup/now
POST   /v1/backup/restore
```

Notes on the non-obvious ones:

- **`PATCH /v1/phrasings/:id` cannot change text.** Text changes only via
  `POST .../revisions`. The route shape makes the append-only rule
  structural rather than a convention someone can forget.
- **`POST /v1/import` returns a plan, not a result.** Parsers are lossy, and
  the data-entry cold start makes import survival-critical. Silently applying a
  mis-parsed resume over a real store would be unforgivable. The user reviews
  and confirms (capability F9.6).
- **`GET /v1/resumes/:id/document` exists for server-side export**, but the
  browser compiles its own preview locally from cached data via the same pure
  function (`application-structure.md` §7). Both call identical code.
- **`/v1/export` is never gated** by auth or entitlement state.
- **`GET /v1/resumes/:id/document` returns a uniform `ResumeDocument`**
  (template-model.md), not the manifest. The manifest is storage-shaped; the
  document is template-shaped, and only the latter is a public contract.
- **`GET /v1/store` returns current state only** — no phrasing revision
  history, no version manifests, no drafts. Those are fetched per subject on
  demand. The "the whole store is only kilobytes" assumption
  holds for current state; revision history grows without bound by design
  and must never be in the boot payload.

---

## 4. The repository port

Defined as interfaces in `@keepcv/core`, implemented by `@keepcv/db` locally
and by the private cloud repo against server PostgreSQL.

```ts
interface Repositories {
  profile:      ProfileRepository;
  organisations:OrganisationRepository;
  records:      RecordRepository;
  points:       PointRepository;
  phrasings:    PhrasingRepository;
  tags:         TagRepository;
  search:       SearchRepository;
  resumes:      ResumeRepository;
  versions:     ResumeVersionRepository;
  drafts:       DraftRepository;
}

interface UnitOfWork {
  run<T>(fn: (repos: Repositories) => Promise<T>): Promise<T>;
}
```

Rules:

- **No repository method accepts an owner id.** Scope comes from an ambient
  request context, so "forgot to scope this query" is structurally impossible
  rather than merely discouraged.
- **Read methods filter `archived_at is null` by default.** Including archived
  rows is an explicit option, never the default.
- **Multi-table operations run inside `UnitOfWork`.** Creating a point writes
  `point`, `phrasing_set`, `phrasing`, `phrasing_revision` and
  `search_document`, and resolves two circular foreign keys along the way
  (data-model.md §5); a partial failure would leave a point with no text.
- **`@keepcv/core` depends only on these interfaces**, never on Drizzle, never
  on a driver. Enforced by a CI dependency check.

---

## 5. Contract testing

A single suite runs against every implementation of `Repositories`:
`@keepcv/db` on PGlite, `@keepcv/db` on server PostgreSQL, and — once it
exists — the cloud implementation. It asserts the invariants in
`data-model.md` §10 rather than the queries, so a divergent implementation
fails loudly instead of subtly.
