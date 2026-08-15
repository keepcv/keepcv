# API Contract

> The boundary between `apps/web` and `@keepcv/api`, and - more importantly -
> the boundary the private cloud repo implements.
> Companion: [`data-model.md`](data-model.md),
> [`application-structure.md`](application-structure.md).

---

## 1. Why this is a first-class artifact

The public/private split works only if the private cloud repo can be a thin
adapter rather than a fork. That requires a boundary that is documented,
versioned and stable - which framework-internal RPC would not give us, and
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

It travels beside the changes rather than among them:

```jsonc
{ "expectedUpdatedAt": "2026-03-01T09:12:44.317Z", "patch": { "title": "Engine" } }
```

Merging it into the patch would not survive a record, whose patch is a union
discriminated on `kind` and so has no single object to add a key to; and a
resource that ever gained a field of that name would shadow it. `DELETE` and
`restore` carry the token alone, since they have nothing to patch.

The header is deliberately not used. `If-Unmodified-Since` has second
granularity and `updated_at` is milliseconds, so half of every comparison would
match a write it should have refused.

**Idempotency.** Creates accept a client-generated UUIDv7 as the resource id, so
a retried create cannot duplicate a row - no idempotency-key header needed. It is
not silently idempotent: the second one is refused by the primary key and comes
back as a `constraint-violated` problem, because a client reusing an id with
different data is a bug, and answering it with the row that is already there
would hide the bug and lose the write.

**Refused writes.** Some rules only the store can enforce - a sort key already
taken, a parent that does not exist, a column a record kind may not carry. These
come back as `constraint-violated` naming the constraint: `409` when it is a
uniqueness clash, since the caller resolves it by re-reading, and `422`
otherwise, since the request was already wrong when it was sent. A driver error
must never reach the client, because a caller mistake reported as `500` sends
everybody looking in the wrong place.

**Partial updates.** `PATCH` with a sparse body. Absent means unchanged; an
explicit `null` clears. This distinction is load-bearing given how many
nullable fields the model has by design (data-model.md P-A).

**Pagination.** Cursor-based on `(sort_key, id)` or `(updated_at, id)`.
UUIDv7's time ordering makes the cursor stable. Most endpoints will never
paginate in practice, but the shape is fixed now so it never becomes breaking:
a list is `{ "items": [...] }` from the first version, so `nextCursor` arrives
alongside it rather than replacing a bare array.

**Archive vs purge.** `DELETE` archives, and `POST /v1/{resource}/{id}/restore`
undoes it - restoring is not a `PATCH`, because `archived_at` belongs to the
store and no patch body may name it. Archived rows are a filter and never a
hiding place: `?archived=include` puts them back in a list, and reading one by
id ignores the flag entirely, so a link to an archived row always resolves.

Purging is `POST /v1/{resource}/{id}/purge` with explicit confirmation -
deliberately not reachable by an accidental `DELETE`.

**Authentication.** Local mode: the per-launch session token in a custom
header. Hosted: Better Auth session. Route handlers see an ambient owner scope
either way and never accept an owner id from the caller.

`/v1/openapi.json` is the one route outside the guard. It describes the contract
rather than exposing any of the store, and the tooling that reads it has not been
handed a token yet.

---

## 3. Resources

```
GET    /v1/store                       whole-store boot payload - CURRENT state only
GET    /v1/store/summary               counts, recent activity, nudges

GET    /v1/profile                     PATCH /v1/profile
CRUD   /v1/contact-channels
CRUD   /v1/organisations
CRUD   /v1/custom-sections             headings the built-in kinds do not cover

CRUD   /v1/records                     ?kind=&tag=&archived=&q=
GET    /v1/records/:id

CRUD   /v1/record-links                ?recordId=&archived=  uniform, any kind
CRUD   /v1/record-fields               ?recordId=&archived=  uniform, any kind

CRUD   /v1/points                      ?recordId=&tag=&confidence=
PUT    /v1/points/:id/records/:recordId   secondary parent; idempotent
DELETE /v1/points/:id/records/:recordId
GET    /v1/points/:id/usage            which resume versions reference it
CRUD   /v1/points/:id/metrics
CRUD   /v1/points/:id/evidence         never included in any render path

GET    /v1/phrasing-sets/:id
PATCH  /v1/phrasing-sets/:id           canonicalPhrasingId - not purpose
POST   /v1/phrasing-sets/:id/phrasings
PATCH  /v1/phrasings/:id               label, variant, sortKey - not text
POST   /v1/phrasings/:id/revisions     append; the only way text changes
GET    /v1/phrasings/:id/revisions     history

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
POST   /v1/resumes/:id/versions        { trigger }  - commits open drafts first
GET    /v1/resumes/:id/versions/:vid
GET    /v1/resumes/:id/versions/diff   ?a=&b=
POST   /v1/resumes/:id/versions/:vid/restore
POST   /v1/resumes/:id/versions/:vid/snapshot   { label, note }

POST   /v1/render                      ResumeDocument -> PDF/HTML
POST   /v1/lint                        ResumeDocument -> lint report

GET    /v1/export                      ?format=native|jsonresume|...
POST   /v1/import                      ?format=native - all or nothing, into an empty store
POST   /v1/import?format=jsonresume    returns a reconciliation plan, not a result
POST   /v1/import/:planId/apply

GET    /v1/backup/status               mirror location, last written
POST   /v1/backup/now
POST   /v1/backup/restore
```

Notes on the non-obvious ones:

- **There is no `/v1/custom-sections/:id/entries`.** What prints under a custom
  heading is a `record` of kind `custom_entry`, so it is created and listed
  through `/v1/records` like every other kind; the section id is a field of the
  record, and moving an entry between headings is a `PATCH` of it.
- **Links and fields are flat collections narrowed by `?recordId`**, not nested
  under the record. The store keys one by its own id alone, so a parent in the
  path would be an identifier no query reads and the row could contradict -
  `/v1/records/A/links/L` where `L` belongs to `B` has to mean something, and
  every answer is worse than not being able to ask. It also keeps one path family
  per resource instead of a nested one for the collection and a flat one for the
  item.
- **There is no `move` route.** A move is a `PATCH` of `sortKey`, which the
  sparse-patch rule above already covers, and a second way to do it would be a
  second thing to keep correct.
- **A record patch naming the wrong kind is a `422`, not a `409`.** A kind never
  changes, so the request was already wrong when it was sent and re-reading would
  not help; the error points at `patch.kind`.
- **`PATCH /v1/phrasings/:id` cannot change text.** Text changes only via
  `POST .../revisions`. The route shape makes the append-only rule
  structural rather than a convention someone can forget.
- **`POST /v1/phrasings/:id/revisions` carries no `If-Match`**, and is the only
  write that does not. Appending cannot conflict: two people appending different
  wordings at once must both keep their text, and posting text the phrasing
  already holds returns the revision that already says it.
- **Which phrasing is canonical is a `PATCH` of the set.** There is no
  `.../canonical` route, for the reason there is no `move` route.
- **`PUT /v1/points/:id/records/:recordId` carries no body and no `If-Match`.**
  The pair is the whole row, so a repeat has nothing to change; `DELETE` on a
  pair that is not linked is a 204 for the same reason. Linking the record the
  point already prints under is a 409: the primary already says it
  (data-model.md I16).
- **A point's primary parent is a `PATCH` of the point.** Setting it to a record
  that is currently a secondary link removes the link in the same transaction.
- **A lossy `POST /v1/import` returns a plan, not a result.** Parsers are lossy,
  and the data-entry cold start makes import survival-critical. Silently applying
  a mis-parsed resume over a real store would be unforgivable. The user reviews
  and confirms before anything is applied.
- **The native format is the exception, and applies directly.** It is not parsed
  and it does not merge: it requires the target to be empty and refuses with
  `store-not-empty` otherwise, so there is no clash for a review step to resolve
  and nothing a plan would say beyond "add all of it". A document written by an
  older build is migrated forward first; one written by a newer build is refused,
  because a mismatched pair of builds is the normal state of self-hosted software
  and half-reading a file is worse than not reading it.
- **`GET /v1/resumes/:id/document` exists for server-side export**, but the
  browser compiles its own preview locally from cached data via the same pure
  function (`application-structure.md` #7). Both call identical code.
- **`/v1/export` is never gated** by auth or entitlement state.
- **`GET /v1/resumes/:id/document` returns a uniform `ResumeDocument`**
  (template-model.md), not the manifest. The manifest is storage-shaped; the
  document is template-shaped, and only the latter is a public contract.
- **`GET /v1/store` returns current state only** - no phrasing revision
  history, no version manifests, no drafts. Those are fetched per subject on
  demand. The "the whole store is only kilobytes" assumption
  holds for current state; revision history grows without bound by design
  and must never be in the boot payload. `GET /v1/export` is the opposite and
  carries everything, history included: an export that drops superseded wordings
  is a delete, and I10 would not hold.

---

## 4. The repository port

Defined as interfaces in `@keepcv/core`, implemented by `@keepcv/db` locally
and by the private cloud repo against server PostgreSQL.

```ts
interface Repositories {
  profile:      ProfileRepository;
  organisations: OrganisationRepository;
  // A heading the built-in kinds do not cover. Its own repository, not a part of
  // the record one: a section outlives every entry in it.
  customSections: CustomSectionRepository;
  // CareerRecord, not Record: the latter shadows TypeScript's built-in in every
  // file that imports it. The table is still `record`.
  records:      CareerRecordRepository;
  points:       PointRepository;
  // Sets, phrasings and revisions together: a set is created with its first
  // phrasing and that phrasing's first text, so none is ever written alone.
  phrasings:    PhrasingRepository;
  tags:         TagRepository;
  search:       SearchRepository;
  resumes:      ResumeRepository;
  versions:     ResumeVersionRepository;
  drafts:       DraftRepository;
  // The native export, whole: `read` returns every row the owner has including
  // archived ones, `load` puts one back with its ids and timestamps intact.
  store:        StoreRepository;
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
  `point`, `phrasing_set`, `phrasing`, `phrasing_revision` and later
  `search_document`, and resolves two circular foreign keys along the way
  (data-model.md #5); a partial failure would leave a point with no text.
- **Metrics and evidence hang off `PointRepository`**, for the reason links and
  fields hang off `CareerRecordRepository`: nothing holds one without holding
  the point it belongs to.
- **A refused write raises `ConstraintViolationError`, never a driver error.**
  The translation happens once, at `UnitOfWork.run`, so it covers every
  repository including ones not written yet. It carries the constraint name and
  whether it was a uniqueness, foreign-key or check failure, which is all the
  caller can act on; the SQL that provoked it is not.
- **Reading one row by id ignores `archived_at`.** Only lists filter. A link to
  an archived row has to resolve, or "where did it go" has no answer. Every
  collection therefore has a read-one method, including the parts that hang off
  an aggregate - `getLink`, `getField`, `getContactChannel` - which a `409` also
  needs, since re-reading the current state is the whole point of that answer.
- **Every key of a `list` option bag is `| undefined` as well as optional.**
  Under `exactOptionalPropertyTypes` those are different types, and the caller
  that forwards a filter it may not have - a route handler passing on a query
  parameter the request did not carry - has the second one.
- **`@keepcv/core` depends only on these interfaces**, never on Drizzle, never
  on a driver. Enforced by a CI dependency check.
- **Every `list` returns a total order.** Two reads of unchanged data give the
  same list, so a round trip can compare whole stores and a UI list does not
  reshuffle under the cursor. Where the natural sort is not unique - an
  organisation's name - the id breaks the tie.
- **`store.load` is the one write that bypasses the concurrency token.** It has
  to: restoring `id`, `created_at` and `updated_at` verbatim is what makes I10
  hold. It is safe because it refuses anything but an empty store.
- **`phrasings.addRevision` takes no token and does not bump one.** Appending is
  conflict-free by construction, and moving `current_revision_id` is derived
  state that no rename actually races - bumping `updated_at` there would reject
  an edit that was never in conflict.

**Native import loads a whole store or nothing.** It requires the target to be
empty - no rows in any collection, and a profile nobody has filled in - and
raises `StoreNotEmptyError` otherwise. Merging two stores is the Import
capability's job, and `POST /v1/import` returning a plan rather than a result is
where that review step lives; guessing which side of a clash to keep is exactly
the unforgivable behaviour that route exists to prevent.

The envelope is not the repository's business: `schemaVersion` and `exportedAt`
belong to the file, so the caller wraps a `Store` in an `ExportDocument` on the
way out and runs `migrateDocument` on the way in. Both are two lines with no
logic worth hiding behind a helper.

---

## 5. Contract testing

A single suite runs against every implementation of `Repositories`:
`@keepcv/db` on PGlite, `@keepcv/db` on server PostgreSQL, and - once it
exists - the cloud implementation. It asserts the invariants in
`data-model.md` #10 rather than the queries, so a divergent implementation
fails loudly instead of subtly.
