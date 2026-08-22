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

GET    /v1/profile                     PATCH /v1/profile
CRUD   /v1/contact-channels
CRUD   /v1/organisations
CRUD   /v1/custom-sections             headings the built-in kinds do not cover

CRUD   /v1/records                     ?kind=&tag=&archived=
GET    /v1/records/:id
GET    /v1/records/:id/usage           which resume versions printed it
GET    /v1/records/:id/tags            the tags it carries
PUT    /v1/records/:id/tags/:tagId     idempotent
DELETE /v1/records/:id/tags/:tagId

CRUD   /v1/record-links                ?recordId=&archived=  uniform, any kind
CRUD   /v1/record-fields               ?recordId=&archived=  uniform, any kind

CRUD   /v1/points                      ?recordId=&tag=&confidence=&archived=
GET    /v1/points/:id/records          the records it also relates to
PUT    /v1/points/:id/records/:recordId   secondary parent; idempotent
DELETE /v1/points/:id/records/:recordId
GET    /v1/points/:id/usage            which resume versions printed it
GET    /v1/points/:id/tags             the tags it carries
PUT    /v1/points/:id/tags/:tagId      idempotent
DELETE /v1/points/:id/tags/:tagId
CRUD   /v1/metrics                     ?pointId=&archived=
CRUD   /v1/evidence                    ?pointId=&archived=  never rendered

CRUD   /v1/phrasing-sets               created holding their first wording
PATCH  /v1/phrasing-sets/:id           canonicalPhrasingId - not purpose
CRUD   /v1/phrasings                   ?phrasingSetId=&archived=
PATCH  /v1/phrasings/:id               label, variant, sortKey - not text
POST   /v1/phrasings/:id/revisions     append; the only way text changes
GET    /v1/phrasings/:id/revisions     history

PUT    /v1/drafts/:targetKind/:targetId/:field   { body }  - no If-Match
DELETE /v1/drafts/:targetKind/:targetId/:field

CRUD   /v1/tags                        ?archived=
POST   /v1/tags/:id/merge              { expectedUpdatedAt, intoTagId }

CRUD   /v1/resumes                     ?archived=
CRUD   /v1/resume-sections             ?resumeId=&archived=
CRUD   /v1/resume-entries              ?resumeId=&resumeSectionId=&archived=
CRUD   /v1/resume-entry-points         ?resumeId=&resumeEntryId=&archived=
GET    /v1/resumes/:id/contact-channels          the overrides this resume carries
PUT    /v1/resumes/:id/contact-channels/:channelId  { isVisible }; idempotent
DELETE /v1/resumes/:id/contact-channels/:channelId  revert to the channel's default
GET    /v1/resumes/:id/document        ?locale=  compiled ResumeDocument

GET    /v1/resume-versions             ?resumeId=
POST   /v1/resume-versions             { id, resumeId, trigger } - the store captures the manifest
GET    /v1/resume-versions/diff        ?a=&b=  only what differs, wordings resolved
GET    /v1/resume-versions/:id         the version and the manifest it pinned
POST   /v1/resume-versions/:id/restore { id } - the version this appends
CRUD   /v1/resume-snapshots            ?resumeId=&archived=

GET    /v1/export                      the whole store, natively
POST   /v1/import                      ?format=native - all or nothing, into an empty store
POST   /v1/import?format=jsonresume    returns a reconciliation plan, not a result
POST   /v1/import/:planId/apply
```

Notes on the non-obvious ones:

- **There is no `/v1/render`.** Rendering is a pure function of a
  `ResumeDocument` and the template that document names, and both run unchanged
  in the browser, so a route would take a document the caller already holds and
  hand back what it could have produced without asking. `renderHtml(document)`
  in `@keepcv/render` is the whole surface; the app calls it on the document it
  compiled in the tab, and `keepcv render` calls it on one it compiled from the
  store. This is the same argument that keeps search and `composition` out of
  the API.
- **There is no `/v1/lint` either, for the same reason.**
  `lint({ document, html })` in `@keepcv/ats-lint` is a pure function of a
  document and the file rendered from it, and the caller holds both by the time
  it wants a verdict. A route would ship the whole resume to the machine it came
  from and answer with a list the caller could have computed. See
  `application-structure.md` #7.2.
- **There is no `/v1/backup/*`.** It used to list three: `status`, `now` and
  `restore`. All three would have handed `createApi` a filesystem, which is the
  one thing it is built not to have - it takes the port, an owner scope and an
  `authenticate` function and nothing else, which is what lets a hosted adapter
  reuse it unchanged. The mirror is the launcher's: `keepcv serve` writes a
  readable copy of the whole store beside the data directory when it starts, on
  a timer, and when it stops, and `keepcv backup` and `keepcv restore` do the
  same two things on demand. The app reaches the same behaviour through
  `/v1/export` and `/v1/import`, which already exist and already carry the whole
  archive. See `application-structure.md` #5.9.
- **`/v1/export` has no `?format=jsonresume`.** It used to be listed with one.
  The native export is a whole-store read, which is genuinely the server's, but
  JSON Resume describes a *resume* - `toJsonResume(document)` in
  `@keepcv/interop` is a pure function of a document the caller already holds,
  and `lossOf(document)` names what it drops. Two answers of different shapes
  behind one query parameter would have been the wrong route either way. See
  `application-structure.md` #7.3.
- **There is no `/v1/custom-sections/:id/entries`.** What prints under a custom
  heading is a `record` of kind `custom_entry`, so it is created and listed
  through `/v1/records` like every other kind; the section id is a field of the
  record, and moving an entry between headings is a `PATCH` of it.
- **Metrics, evidence, links, fields and the three levels of a resume's
  composition are flat collections** narrowed by `?pointId`, `?recordId` or
  `?resumeId`, not nested under their parent. The store keys one
  by its own id alone, so a parent in the path would be an identifier no query
  reads and the row could contradict - `/v1/records/A/links/L` where `L` belongs
  to `B` has to mean something, and every answer is worse than not being able to
  ask. It also keeps one path family per resource instead of a nested one for the
  collection and a flat one for the item.
- **Nesting is reserved for what has no id of its own.**
  `PUT /v1/points/:id/records/:recordId` is nested because the pair *is* the row,
  and `.../revisions` because a revision is appended to a phrasing rather than
  created in a collection. Both of those nested lists answer `404` for a parent
  that does not exist: an empty list would read as "this point relates to
  nothing" or "this phrasing has never said anything", and neither is a state the
  store can be in.
- **There is no `GET /v1/resumes/:id/composition`.** What a resume is made of is
  `composition(store, resumeId)` in `@keepcv/core`, for the reason there is no
  `/v1/store/summary`: every row it reads is already in the boot payload, so a
  route would answer with data the client holds and the preview would resolve a
  resume twice, once per side. The three collections above are what a client
  writes through; reading is a selector.
- **A resume's contact channels are overrides, and nested.** The pair is the
  whole row, like a tag assignment: `PUT` carries only `isVisible` and no
  concurrency token, and `DELETE` is a revert to the channel's own
  `isDefaultVisible` rather than a hide - so clearing one that was never
  overridden is the same `204`. A channel with no row prints by its own default,
  which is why creating a resume writes none of them.
- **A composition row is never moved between resumes.** `resumeId` - and a
  section's `kind` - are what the row was created as, and no patch schema has a
  key for them, so a body naming one has it dropped at the boundary. Moving an
  entry to another resume is adding it there and archiving it here; the two
  resumes then hold their own phrasing choices, which is the point.
- **There is no `GET /v1/search`.** Search is a pure function over the boot
  payload the client already holds (data-model.md #8), so it is a selector in
  `@keepcv/core` rather than a route - the same reasoning as there being no
  `/v1/store/summary`, and it also removes the round trip per keystroke that
  search-as-you-type cannot afford. `/v1/records` therefore takes no `?q=`
  either; a caller narrowing by text is a caller who should read the store.
- **A tag is assigned from the side that carries it.** `PUT
  /v1/records/:id/tags/:tagId` is nested because the pair is the whole row, like
  a point's secondary records - it takes no body and no `If-Match`, a repeat has
  nothing to change, and a `DELETE` of a pair that was never assigned is the same
  204. The tag it names is a `422` when it does not exist, and the record is a
  `404`: the subject of the request is the row in the path.
- **A tag's `slug` is derived and appears in no input.** It is the projection its
  uniqueness is enforced on, so the store computes it from the label on every
  write; a body carrying one has it dropped at the boundary. A second label
  projecting to a slug already taken is a `409` naming `tag_slug_unique`.
- **`POST /v1/tags/:id/merge` carries the concurrency token of the tag being
  merged away**, since that is the row it archives. Merging a tag into itself is
  a `422` pointing at `intoTagId` - nothing changed under the caller and
  re-reading would not help.
- **A draft is addressed by what it drafts.** The target is its identity, so
  there is no id to put in a path, and there is no `GET`: every draft arrives in
  the boot payload, and an editor asking per field would be a round trip
  answering "no" nearly every time. `PUT` carries no concurrency token - the next
  keystrokes are meant to replace the last ones - and `DELETE` of a field with no
  draft is the same `204`. A target that does not exist is a `404`, because the
  row in the path is the subject of the request; a `targetKind` outside the
  vocabulary, or a `field` that is not a plain path segment, is a `422`.
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
- **Phrasing sets and phrasings are ordinary collections.** A set is created
  holding its first wording - `POST /v1/phrasing-sets` carries it - so there is
  no `POST /v1/phrasing-sets/:id/phrasings`; a further wording is a
  `POST /v1/phrasings` naming the set, like any other owned row. Creating a point
  writes its set and first wording in the same transaction, so a client never
  creates one for a point itself.
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
  function (`application-structure.md` #7). Both call `compile()` in
  `@keepcv/core`. It is a `404` for a resume that is not there, which is what
  the selector's `undefined` becomes at the boundary.
- **`/v1/export` is never gated** by auth or entitlement state.
- **`GET /v1/resumes/:id/document` returns a uniform `ResumeDocument`**
  (template-model.md), not the manifest. The manifest is storage-shaped; the
  document is template-shaped, and only the latter is a public contract.
- **A version is five routes, not six, and a snapshot is a collection.** A
  version is keyed by its own id like everything else, so it is flat and narrowed
  by `?resumeId=` for the reason links and fields are; it has no `PATCH` and no
  archive because it is immutable. `diff` and `restore` are the other two. A
  snapshot is an ordinary owned row - a label on a version - so it is the usual
  six, and starring, relabelling and unstarring are its create, patch and archive
  rather than three verbs of their own.
- **`GET /v1/resume-versions/diff` is declared before `/v1/resume-versions/{id}`**,
  or the parameterised route claims it and the whole thing answers `422` on a word
  that is not a uuid. It compares any two versions, of one resume or of two: the
  answer is only what differs, and both are immutable, so it never goes stale.
  The pinned wordings come back **resolved to text**, because a diff whose reader
  has to fetch two revisions to find out what changed has not answered the
  question. It is a route rather than a selector - the exception to
  `composition()` and `search()` - because manifests are the one thing the boot
  payload deliberately does not carry.
- **`POST /v1/resume-versions/{id}/restore` writes the selection back and appends.**
  It never rewinds: what happened in between stays on the timeline and the new
  entry names the version it came from. The id in the body is the version it
  appends; the one in the path is the version it comes from. It answers `201` with
  that version and with **what it could not place** - a manifest names rows by id,
  and the store may no longer hold one - rather than refusing whole.

  **A restore puts back the selection, not the words.** A version pins
  `phrasing_revision_id`s; a resume selects a `phrasing`. So a restored
  composition prints whatever that phrasing says today, and the version keeps the
  text it recorded. Restoring is not a way to undo an edit to a point - that is
  what a phrasing's own history is for.

  **It leaves the record store alone** for the same reason: the manifest pins
  whole records so that history cannot be rewritten, not so that history can
  rewrite the present. What it does write is the resume's sections, entries,
  points, contact-channel overrides and target context.
- **The manifest is captured by the store, not sent by the client.** A version
  records what the resume said, which the client is in no position to assert. The
  body carries the id, the resume and the trigger only. `POST` answers `201` with
  a new version, or `200` with the current one unchanged when the manifest has
  not moved since it was captured (data-model.md #9.2) - so a client that exports
  twice gets one timeline entry and can tell which happened.
- **Capture does not commit open drafts.** A version records what the store says;
  turning in-progress text into history as a side effect of pressing Export is
  the surprise drafts exist to prevent.
- **`GET /v1/store` returns current state only** - no phrasing revision
  history and no version manifests. Those are fetched per subject on
  demand. The "the whole store is only kilobytes" assumption
  holds for current state; revision history grows without bound by design
  and must never be in the boot payload. `GET /v1/export` is the opposite and
  carries everything, history included: an export that drops superseded wordings
  is a delete, and I10 would not hold.

  **Drafts are in it.** They are not history: there is at most one per field and
  it is the newest thing the user wrote, so they are bounded and they are
  current. The editor has to know a draft is waiting before it opens, which is
  why the alternative - a `GET` per field - is not the cheaper one.

  It answers the `Store` shape, with `phrasingRevisions` narrowed to the
  revision each phrasing currently points at - so every point arrives with the
  words it says, and none of the words it used to say. The export wraps
  `Archive`, which is that shape plus `resumeVersions` and `resumeSnapshots`:
  the two diverged when versions joined the export, and they are two schemas so
  that a selector cannot read history off a payload that does not carry it.

  **Archived rows are in it.** "Current" means "not history", not "not
  archived": the archived filter is a client-side toggle over rows it already
  holds, and making it a second request would put a network round trip in front
  of "where did my old entry go".
- **There is no `/v1/store/summary`.** Counts, recent activity and every
  incompleteness nudge are pure functions of the payload above, which the client
  already has cached. Computing them again in SQL would be the same numbers
  derived twice, drifting the first time a rule changed on one side only. They
  live as selectors in `@keepcv/core`, which runs in the browser, so the store
  overview screen and anything server-side asking the same question call one
  implementation.

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
  // The vocabulary and both sides of it: a tag outlives everything carrying it,
  // and rename and merge are operations on the word rather than on the rows.
  // There is no search repository - search is a selector in core (#3).
  tags:         TagRepository;
  // Keyed by what it drafts rather than by an id: `save` overwrites and takes no
  // token, and `discard` is the one delete the store performs.
  drafts:       DraftRepository;
  resumes:      ResumeRepository;
  // Append-only, and the usage index projected out of every manifest it holds.
  versions:     ResumeVersionRepository;
  // The native export, whole: `read` returns every row the owner has including
  // archived ones and its history, `load` puts one back with its ids and
  // timestamps intact.
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
  `point`, `phrasing_set`, `phrasing` and `phrasing_revision`, and resolves two
  circular foreign keys along the way (data-model.md #5); a partial failure would
  leave a point with no text. Merging a tag moves both sides of the vocabulary
  and archives a row, for the same reason.
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
- **`phrasings.listRevisions` narrows by `ids` as well as by phrasing.** A
  manifest names revisions, and both a diff and a restore need the ones it names
  rather than every revision of some phrasing. An empty list asks for nothing and
  answers nothing.
- **A restore is planned in `@keepcv/core` and applied through `ResumeRepository`**,
  so it adds no method of its own. `restorePlan(store, resumeId, manifest,
  revisions)` answers the changes to make - what to add, what to patch, what to
  toggle off, and what it could not place - and the route applies them inside one
  `UnitOfWork.run`. The planning is pure, so the awkward parts are tested without
  a database, and the writing stays where every other write is.

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
