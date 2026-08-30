# API Contract

> The boundary between `apps/web` and `@keepcv/api`, and the one anything else
> that serves this store has to hold to.
> Companion: [`data-model.md`](data-model.md),
> [`application-structure.md`](application-structure.md).

---

## 1. Why this is a first-class artifact

A store people run themselves is a store whose client and server drift out of
step, so the boundary between them is designed, documented and versioned rather
than emitted as a side effect of one client's shape.

---

## 2. Conventions

**Versioning.** All routes are under `/v1/`. Mismatched client and server builds
are the normal state of self-hosted software.

**Transport.** JSON over HTTP, validated against the same Zod schemas the client
uses. An OpenAPI document is generated from those schemas and served at
`/v1/openapi.json`.

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

**Concurrency.** Mutations carry the `updated_at` they were based on. A mismatch
returns `409` *with the current server state*, so the UI can present a comparison
rather than discarding one side silently. It travels beside the changes rather
than among them:

```jsonc
{ "expectedUpdatedAt": "2026-03-01T09:12:44.317Z", "patch": { "title": "Engine" } }
```

Merging it into the patch would not survive a record, whose patch is a union
discriminated on `kind` and so has no single object to add a key to; and a
resource that ever gained a field of that name would shadow it. `DELETE` and
`restore` carry the token alone, having nothing to patch.

The header is deliberately not used: `If-Unmodified-Since` has second
granularity and `updated_at` is milliseconds, so half of every comparison would
match a write it should have refused.

**Idempotency.** Creates accept a client-generated UUIDv7 as the resource id, so
a retried create cannot duplicate a row - no idempotency-key header needed. It is
not silently idempotent: the second one is refused by the primary key as a
`constraint-violated` problem, because a client reusing an id with different data
is a bug, and answering with the row already there would hide it and lose the
write.

**Refused writes.** Some rules only the store can enforce - a sort key already
taken, a parent that does not exist, a column a record kind may not carry. These
come back as `constraint-violated` naming the constraint: `409` for a uniqueness
clash, since the caller resolves it by re-reading, and `422` otherwise, since the
request was already wrong when it was sent. A driver error must never reach the
client: a caller mistake reported as `500` sends everybody looking in the wrong
place.

**Partial updates.** `PATCH` with a sparse body. Absent means unchanged; an
explicit `null` clears. Load-bearing given how many nullable fields the model has
by design (data-model.md P-A).

**Pagination.** Cursor-based on `(sort_key, id)` or `(updated_at, id)`; UUIDv7's
time ordering makes the cursor stable. Most endpoints will never paginate, but a
list is `{ "items": [...] }` from the first version so `nextCursor` can arrive
alongside it rather than replacing a bare array.

**Archive vs purge.** `DELETE` archives and `POST /v1/{resource}/{id}/restore`
undoes it - restoring is not a `PATCH`, because `archived_at` belongs to the
store and no patch body may name it. Archived rows are a filter and never a
hiding place: `?archived=include` puts them back in a list, and reading one by id
ignores the flag entirely, so a link to an archived row always resolves.

Purging is `POST /v1/{resource}/{id}/purge` with explicit confirmation -
deliberately not reachable by an accidental `DELETE`.

**Authentication.** `createApi` takes an `authenticate` function and knows
nothing else about it: whatever serves the API decides how a request names an
owner (#6). Route handlers see an ambient owner scope and never accept an owner
id from the caller.

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

CRUD   /v1/saved-filters               ?subject=&archived=
CRUD   /v1/tags                        ?archived=
POST   /v1/tags/:id/merge              { expectedUpdatedAt, intoTagId }

CRUD   /v1/role-profiles               ?archived=
GET    /v1/role-profiles/:id/tags      the words it selects by
PUT    /v1/role-profiles/:id/tags/:tagId    idempotent
DELETE /v1/role-profiles/:id/tags/:tagId
POST   /v1/role-profiles/:id/apply     { resumeId } - places what it selects

CRUD   /v1/templates                   ?archived=   the user's designs; the
                                                    shipped ones are in the build
CRUD   /v1/resumes                     ?archived=
CRUD   /v1/resume-sections             ?resumeId=&archived=
CRUD   /v1/resume-entries              ?resumeId=&resumeSectionId=&archived=
CRUD   /v1/resume-entry-points         ?resumeId=&resumeEntryId=&archived=
GET    /v1/resumes/:id/contact-channels          the overrides this resume carries
PUT    /v1/resumes/:id/contact-channels/:channelId  { isVisible }; idempotent
DELETE /v1/resumes/:id/contact-channels/:channelId  revert to the channel's default
GET    /v1/resumes/:id/document        ?locale=  compiled ResumeDocument
POST   /v1/resumes/:id/derive          { id, name } - a new resume from this one

GET    /v1/resume-versions             ?resumeId=
POST   /v1/resume-versions             { id, resumeId, trigger } - the store captures the manifest
GET    /v1/resume-versions/diff        ?a=&b=  only what differs, wordings resolved
GET    /v1/resume-versions/:id         the version and the manifest it pinned
GET    /v1/resume-versions/:id/document          what it said, in the words it pinned
POST   /v1/resume-versions/:id/restore { id } - the version this appends
CRUD   /v1/resume-snapshots            ?resumeId=&archived=

GET    /v1/export                      the whole store, natively
POST   /v1/import                      all or nothing, into an empty store
POST   /v1/intake                      { intake, decisions } - a resume another tool wrote
```

### What is deliberately not a route

**If the caller already holds every input, it is a function, not a route.** A
route would ship data to the machine it came from and answer with something the
caller could have computed - and `@keepcv/core` and `@keepcv/render` run
unchanged in the browser, so there is nowhere the answer could only be reached.
This excludes six things that look like routes and are not:

| Not a route | It is | Because |
|---|---|---|
| `/v1/render` | `renderHtml(document)` in `@keepcv/render` | the app calls it on the document it compiled in the tab; `keepcv render` calls it on one compiled from the store |
| `/v1/lint` | `lint({ document, html })` in `@keepcv/ats-lint` | the caller holds both by the time it wants a verdict |
| `/v1/search` | `search(store, query)` in `@keepcv/core` | it also removes the round trip per keystroke that search-as-you-type cannot afford, so `/v1/records` takes no `?q=` either |
| `/v1/resumes/:id/composition` | `composition(store, resumeId)` | every row is in the boot payload, and the preview would otherwise resolve a resume twice, once per side |
| `/v1/store/summary` | counts, recent activity and every nudge, as selectors | the same numbers derived twice drift the first time a rule changes on one side only |
| `/v1/export?format=` | `toJsonResume`, `toDocx`, `toLatex` and `toTypst` in `@keepcv/interop`, with `lossOf(document, target)` naming what each drops | the native export is a whole-store read, genuinely the server's; the others describe a *resume*, and two answers of different shapes behind one query parameter is the wrong route either way |

**Three writes are the exception, and their plans are made server-side.**
`/v1/intake`, `/v1/resumes/:id/derive` and `/v1/role-profiles/:id/apply` each
have a pure planner in `@keepcv/core` - `importPlan`, `derivePlan` and
`roleProfilePlan(store, resumeId, roleProfileId)` - and each route re-plans
from what it was sent and applies in one transaction. A client-computed list of
rows to write is a client deciding what the store contains. Applying a role
profile answers what it *placed* rather than the resume: it is additive, never
takes anything off, and applying one twice writes nothing the second time.

**There is no `/v1/backup/*`.** `status`, `now` and `restore` would each have
handed `createApi` a filesystem, the one thing it is built not to have. The
mirror is the launcher's: `keepcv serve` writes a readable copy beside the data
directory on start, on a timer and on stop; `keepcv backup` and `keepcv restore`
do the same on demand. The app reaches it through `/v1/export` and
`/v1/import` (`application-structure.md` #5.9).

**There is no `/v1/custom-sections/:id/entries`.** What prints under a custom
heading is a `record` of kind `custom_entry`, created and listed through
`/v1/records` like every other kind; the section id is a field of the record, and
moving an entry between headings is a `PATCH` of it.

### Flat, nested, and why

**A row with an id of its own is a flat collection**, narrowed by `?pointId`,
`?recordId` or `?resumeId`: metrics, evidence, links, fields and all three levels
of a resume's composition. The store keys each by its own id alone, so a parent
in the path would be an identifier no query reads and the row could contradict -
`/v1/records/A/links/L` where `L` belongs to `B` has to mean something, and every
answer is worse than not being able to ask. It also keeps one path family per
resource instead of a nested one for the collection and a flat one for the item.

**Nesting is reserved for what has no id of its own** - a pair that *is* the row,
or an append. Those carry no body and no concurrency token, since a repeat has
nothing to change, and a `DELETE` of a pair that was never there is the same
`204`:

- `PUT /v1/points/:id/records/:recordId` - a secondary parent. Linking the record
  the point already prints under is a `409`: the primary already says it
  (data-model.md I16).
- `PUT /v1/records/:id/tags/:tagId`, `PUT /v1/points/:id/tags/:tagId`,
  `PUT /v1/role-profiles/:id/tags/:tagId` - a tag is assigned from the side that
  carries it. The tag named is a `422` when it does not exist and the subject is
  a `404`: the subject of the request is the row in the path.
- `PUT /v1/resumes/:id/contact-channels/:channelId` - an override, carrying only
  `isVisible`. `DELETE` is a revert to the channel's own `isDefaultVisible`
  rather than a hide, so clearing one that was never overridden is the same
  `204`. A channel with no row prints by its own default, which is why creating a
  resume writes none of them.
- `POST /v1/phrasings/:id/revisions` - appended to a phrasing rather than created
  in a collection.

The two nested *lists* answer `404` for a parent that does not exist: an empty
list would read as "this point relates to nothing" or "this phrasing has never
said anything", and neither is a state the store can be in.

### Notes on the rest

- **There is no `move` route.** A move is a `PATCH` of `sortKey`, which the
  sparse-patch rule already covers, and a second way to do it would be a second
  thing to keep correct. Which phrasing is canonical is a `PATCH` of the set for
  the same reason - there is no `.../canonical`.
- **A composition row is never moved between resumes.** `resumeId` - and a
  section's `kind` - are what the row was created as, and no patch schema has a
  key for them, so a body naming one has it dropped at the boundary. Moving an
  entry to another resume is adding it there and archiving it here; the two
  resumes then hold their own phrasing choices, which is the point.
- **A record patch naming the wrong kind is a `422`, not a `409`.** A kind never
  changes, so the request was already wrong when it was sent; the error points at
  `patch.kind`.
- **A point's primary parent is a `PATCH` of the point.** Setting it to a record
  that is currently a secondary link removes the link in the same transaction.
- **A tag's `slug` is derived and appears in no input.** It is the projection its
  uniqueness is enforced on, so the store computes it from the label on every
  write; a body carrying one has it dropped at the boundary. A second label
  projecting to a slug already taken is a `409` naming `tag_slug_unique`.
- **`POST /v1/tags/:id/merge` carries the concurrency token of the tag being
  merged away**, since that is the row it archives. Merging a tag into itself is
  a `422` pointing at `intoTagId` - nothing changed under the caller, and
  re-reading would not help.
- **A draft is addressed by what it drafts.** The target is its identity, so
  there is no id to put in a path, and no `GET`: every draft arrives in the boot
  payload, and an editor asking per field would be a round trip answering "no"
  nearly every time. `PUT` carries no concurrency token - the next keystrokes are
  meant to replace the last ones - and `DELETE` of a field with no draft is the
  same `204`. A target that does not exist is a `404`; a `targetKind` outside the
  vocabulary, or a `field` that is not a plain path segment, is a `422`.
- **`PATCH /v1/phrasings/:id` cannot change text**, which makes the append-only
  rule structural rather than a convention someone can forget. `POST
  .../revisions` is the only write in the whole API carrying no concurrency
  token: appending cannot conflict, two people appending different wordings must
  both keep their text, and posting text the phrasing already holds returns the
  revision that already says it.
- **Phrasing sets and phrasings are ordinary collections.** A set is created
  holding its first wording, so there is no `POST /v1/phrasing-sets/:id/phrasings`
  - a further wording is a `POST /v1/phrasings` naming the set. Creating a point
  writes its set and first wording in the same transaction, so a client never
  creates one for a point itself.
- **A resume another tool wrote arrives reviewed, at `POST /v1/intake`.** Parsers
  are lossy and the data-entry cold start makes import survival-critical, so
  silently applying a mis-parsed resume over a real store would be unforgivable:
  the body carries the `Intake` and the decision taken on every row in it, and
  the user has seen both. Parsing is not on this surface at all - the browser
  reads the file in the tab, so a resume never leaves the machine. Every write is
  a create or a put-back, so applying one file twice writes nothing the second
  time.
- **The native format is a different route and applies directly.** It is not
  parsed and it does not merge: `POST /v1/import` requires the target to be empty
  and refuses with `store-not-empty` otherwise, so there is no clash to review and
  nothing a decision would say beyond "add all of it". A document written by an
  older build is migrated forward first; one written by a newer build is refused,
  because a mismatched pair of builds is the normal state of self-hosted software
  and half-reading a file is worse than not reading it.
- **`POST /v1/resumes/:id/derive` copies the selection, not the posting.** The
  composition and the template come across; the job it was aimed at does not,
  because the reason to start from another resume is that this one is going
  somewhere else.
- **`GET /v1/resumes/:id/document` exists for server-side export**, but the
  browser compiles its own preview locally from cached data via the same
  `compile()` (`application-structure.md` #7). It returns a uniform
  `ResumeDocument` (template-model.md), not the manifest: the manifest is
  storage-shaped, the document is template-shaped, and only the latter is a
  public contract. A resume that is not there is a `404`, which is what the
  selector's `undefined` becomes at the boundary.
- **`/v1/export` is never gated** by auth or entitlement state.

### The resume timeline

- **A version has no `PATCH` and no archive**, because it is immutable. It is
  keyed by its own id and narrowed by `?resumeId=`, for the reason links and
  fields are. A snapshot is an ordinary owned row - a label on a version - so it
  is the usual six routes, and starring, relabelling and unstarring are its
  create, patch and archive rather than three verbs of their own.
- **The manifest is captured by the store, not sent by the client.** A version
  records what the resume said, which the client is in no position to assert; the
  body carries the id, the resume and the trigger only. `POST` answers `201` with
  a new version, or `200` with the current one when the manifest has not moved
  since it was captured (data-model.md #9.2) - so a client that exports twice
  gets one timeline entry and can tell which happened. **Capture does not commit
  open drafts**: turning in-progress text into history as a side effect of
  pressing Export is the surprise drafts exist to prevent.
- **`GET /v1/resume-versions/:id/document`** compiles what a version said in the
  words it pinned, so sending an old one does not mean restoring it first.
- **`GET /v1/resume-versions/diff` is declared before
  `/v1/resume-versions/{id}`**, or the parameterised route claims it and the
  whole thing answers `422` on a word that is not a uuid. It compares any two
  versions, of one resume or of two; the answer is only what differs, and both
  are immutable, so it never goes stale. The pinned wordings come back
  **resolved to text**, because a diff whose reader has to fetch two revisions
  to find out what changed has not answered the question. It is a route rather
  than a selector - the exception to the table above - because manifests are
  the one thing the boot payload deliberately does not carry.
- **`POST /v1/resume-versions/:id/restore` writes the selection back and
  appends.** It never rewinds: what happened in between stays on the timeline
  and the new entry names the version it came from. The id in the body is the
  version it appends; the one in the path is the version it comes from. It
  answers `201` with that version and with **what it could not place** - a
  manifest names rows by id, and the store may no longer hold one - rather than
  refusing whole.

  **It puts back the selection, not the words.** A version pins
  `phrasing_revision_id`s; a resume selects a `phrasing`. So a restored
  composition prints whatever that phrasing says today, and the version keeps the
  text it recorded. Restoring is not a way to undo an edit to a point - that is
  what a phrasing's own history is for.

  **It leaves the record store alone** for the same reason: the manifest pins
  whole records so that history cannot be rewritten, not so that history can
  rewrite the present. What it writes is the resume's sections, entries, points,
  contact-channel overrides and target context.

### The boot payload

**`GET /v1/store` returns current state only** - no phrasing revision history and
no version manifests, which are fetched per subject on demand. The "the whole
store is only kilobytes" assumption holds for current state; revision history
grows without bound by design and must never be in the boot payload.
`GET /v1/export` is the opposite and carries everything, history included: an
export that drops superseded wordings is a delete, and I10 would not hold.

It answers the `Store` shape, with `phrasingRevisions` narrowed to the revision
each phrasing currently points at - so every point arrives with the words it
says, and none of the words it used to say. The export wraps `Archive`, which is
that shape plus `resumeVersions` and `resumeSnapshots`: two schemas, so that a
selector cannot read history off a payload that does not carry it.

**Drafts are in it.** They are not history: there is at most one per field and it
is the newest thing the user wrote, so they are bounded and current. The editor
has to know a draft is waiting before it opens, which is why the alternative - a
`GET` per field - is not the cheaper one.

**Archived rows are in it.** "Current" means "not history", not "not archived":
the archived filter is a client-side toggle over rows it already holds, and
making it a second request would put a network round trip in front of "where did
my old entry go".

---

## 4. The repository port

Defined as interfaces in `@keepcv/core` and implemented by `@keepcv/db`, on
PGlite locally and on server PostgreSQL.

```ts
interface Repositories {
  profile:        ProfileRepository;
  organisations:  OrganisationRepository;
  // A heading the built-in kinds do not cover. Its own repository, not a part of
  // the record one: a section outlives every entry in it.
  customSections: CustomSectionRepository;
  savedFilters:   SavedFilterRepository;
  roleProfiles:   RoleProfileRepository;
  // Only the user's designs. The shipped ones are in every build.
  templates:      TemplateRepository;
  // CareerRecord, not Record: the latter shadows TypeScript's built-in in every
  // file that imports it. The table is still `record`.
  records:        CareerRecordRepository;
  points:         PointRepository;
  // Sets, phrasings and revisions together: a set is created with its first
  // phrasing and that phrasing's first text, so none is ever written alone.
  phrasings:      PhrasingRepository;
  // The vocabulary and both sides of it: a tag outlives everything carrying it,
  // and rename and merge are operations on the word rather than on the rows.
  // There is no search repository - search is a selector in core (#3).
  tags:           TagRepository;
  resumes:        ResumeRepository;
  // Append-only, and the usage index projected out of every manifest it holds.
  versions:       ResumeVersionRepository;
  // Keyed by what it drafts rather than by an id: `save` overwrites and takes no
  // token, and `discard` is the one delete the store performs.
  drafts:         DraftRepository;
  // The native export, whole: `read` returns every row the owner has including
  // archived ones and its history, `load` puts one back with its ids and
  // timestamps intact.
  store:          StoreRepository;
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
- **Multi-table operations run inside `UnitOfWork`**, which is the only way to
  reach a repository. Creating a point writes `point`, `phrasing_set`, `phrasing`
  and `phrasing_revision` and resolves two circular foreign keys along the way
  (data-model.md #5); a partial failure would leave a point with no text. Merging
  a tag moves both sides of the vocabulary and archives a row, for the same
  reason.
- **Metrics and evidence hang off `PointRepository`**, for the reason links and
  fields hang off `CareerRecordRepository`: nothing holds one without holding the
  point it belongs to.
- **A refused write raises `ConstraintViolationError`, never a driver error.**
  The translation happens once, at `UnitOfWork.run`, so it covers every
  repository including ones not written yet. It carries the constraint name and
  whether it was a uniqueness, foreign-key or check failure, which is all the
  caller can act on; the SQL that provoked it is not.
- **Reading one row by id ignores `archived_at`.** Only lists filter. A link to
  an archived row has to resolve, or "where did it go" has no answer. Every
  collection therefore has a read-one method, including the parts that hang off an
  aggregate - `getLink`, `getField`, `getContactChannel` - which a `409` also
  needs, since re-reading the current state is the whole point of that answer.
- **Every key of a `list` option bag is `| undefined` as well as optional.**
  Under `exactOptionalPropertyTypes` those are different types, and the caller
  that forwards a filter it may not have - a route handler passing on a query
  parameter the request did not carry - has the second one.
- **`@keepcv/core` depends only on these interfaces**, never on Drizzle, never on
  a driver. Enforced by a CI dependency check.
- **Every `list` returns a total order.** Two reads of unchanged data give the
  same list, so a round trip can compare whole stores and a UI list does not
  reshuffle under the cursor. Where the natural sort is not unique - an
  organisation's name - the id breaks the tie.
- **`store.load` is the one write that bypasses the concurrency token.** It has
  to: restoring `id`, `created_at` and `updated_at` verbatim is what makes I10
  hold. It is safe because it refuses anything but an empty store.
- **`phrasings.addRevision` takes no token and does not bump one.** Appending is
  conflict-free by construction, and moving `current_revision_id` is derived state
  that no rename actually races - bumping `updated_at` there would reject an edit
  that was never in conflict.
- **`phrasings.listRevisions` narrows by `ids` as well as by phrasing.** A
  manifest names revisions, and both a diff and a restore need the ones it names
  rather than every revision of some phrasing. An empty list asks for nothing and
  answers nothing.
- **A restore adds no repository method**: it is planned in `@keepcv/core` and
  applied through `ResumeRepository`. `restorePlan(store, resumeId, manifest,
  revisions)` answers what to add, patch, toggle off and what it could not place,
  and the route applies it inside one `UnitOfWork.run`. The planning is pure, so
  the awkward parts are tested without a database, and the writing stays where
  every other write is.

**Native import loads a whole store or nothing.** It requires the target to be
empty - no rows in any collection, and a profile nobody has filled in - and
raises `StoreNotEmptyError` otherwise. Merging into a store that already holds
something is `POST /v1/intake`, where the user has reviewed every row first;
guessing which side of a clash to keep is exactly the unforgivable behaviour that
review exists to prevent.

The envelope is not the repository's business: `schemaVersion` and `exportedAt`
belong to the file, so the caller wraps a `Store` in an `ExportDocument` on the
way out and runs `migrateDocument` on the way in.

---

## 5. Contract testing

One suite runs against every implementation of `Repositories`: `@keepcv/db` on
PGlite and `@keepcv/db` on server PostgreSQL today, and anything else that ever
implements the port. It asserts the invariants in `data-model.md` #10 rather than
the queries, so a divergent implementation fails loudly instead of subtly.

---

## 6. Serving it yourself

`createApi` takes `authenticate` and nothing else: no driver, no filesystem, no
port and no password. Everything below belongs to the launcher, for the same
reason the backup mirror does.

### The three modes

| `--auth` | Who is asking | For |
|---|---|---|
| `token` (default) | a token minted per launch, in `x-keepcv-session` | one person, one machine, loopback |
| `password` | a signed cookie handed out for a password | a machine reached from a phone, a LAN or a tunnel |
| `proxy` | a header an upstream sets, from an address the launcher trusts | an instance already behind SSO, oauth2-proxy, Tailscale or a corporate gateway |

**Binding off loopback refuses `token`.** That token is minted per run, printed
to a terminal and held only in memory: it cannot survive a restart, cannot be
typed on the device reading the store, and is the entire credential for anything
that can reach the port. The launcher will not start that way.

**Nothing here is a user system.** A self-hosted store holds exactly one owner,
and all three modes answer the same owner id. Accounts, sign-up, verification and
anything that could gate a feature are not in this repository.

**The password mode.** `keepcv set-password` writes `auth.json` into the data
directory, mode `0600`, holding a scrypt hash and a signing secret. The
parameters are `N=2^14, r=8, p=1` - about 16MB and a tenth of a second - and are
recorded in the stored string so raising them later does not lock anybody out.
Node's own `scrypt` rather than argon2id, which is the better function and the
only reason the launcher would take a native dependency; the cost of being wrong
is bounded by the throttle and by the attacker having to reach the port at all.

A session is `<ownerId>.<expiry>.<hmac-sha256>` in a `keepcv.session` cookie -
`HttpOnly`, `SameSite=Strict`, thirty days. Stateless, so a restart does not end
a session and there is no session table to keep; revocation is rotating the
secret, which is what setting a password does. No `Secure` flag: the launcher
serves plain HTTP, and a proxy in front of it is the only thing that could be
terminating TLS. Sign-in is throttled to five refusals a minute, since scrypt at
a tenth of a second on its own leaves room for tens of thousands of guesses an
hour.

**The proxy mode.** `--auth proxy --proxy-header X-Forwarded-User` reads the user
the upstream named. `--proxy-from` is the only address that header is read from,
default `127.0.0.1`, and a request from anywhere else is refused before it
reaches a route - otherwise anyone who can reach the port sets the header
themselves. `--proxy-user` pins the one value that header may carry.

This is deliberately not an OIDC client. One here would be a second thing to keep
correct with no way to test it against the providers people actually use; a proxy
is what those deployments already have in front of everything else they
self-host.

### The launcher's own routes

Outside `/v1`, so they are invisible to `createApi` and to the OpenAPI document.

| Route | |
|---|---|
| `GET /auth/mode` | `{ mode, signedIn }`, no credential required |
| `POST /auth/sign-in` | password mode only; `{ password }` in, `Set-Cookie` out; `404` where there is no password |
| `POST /auth/sign-out` | clears the cookie |

`/auth/mode` takes no credential because the app has to know which of three
screens to render before it has anything to send, and `signedIn` is on it because
the cookie is `HttpOnly` and only the launcher can say whether it is still good.
`{ mode, signedIn }` is the whole of it: those two answer all three screens, and a
field neither screen reads would be a field the launcher has to keep true.

The web app asks once, before the first render. No token in token mode is the
landing page; no session in password mode is the sign-in screen; no user in proxy
mode is a message saying the upstream let the request through without naming one,
which is a misconfiguration rather than something to retry. The router never
mounts in any of the three.
