# Application Structure

> How the shapes defined in [`data-model.md`](data-model.md) move through the
> layers and reach the screen. Read that document first.

The data model is only half the design. This document defines *where each type
lives*, *who is allowed to transform it*, and *what state the UI owns* - the
decisions that determine whether feature code stays thin or turns into a
tangle of ad-hoc mapping.

---

## 1. The four representations

One concept has four legitimate shapes. Conflating them is the most common way
a codebase like this rots.

| # | Shape | Lives in | Owns | Example |
|---|---|---|---|---|
| 1 | **Row** | `@keepcv/db` | storage layout | `point` table row + joined `phrasing_revision` |
| 2 | **Entity** | `@keepcv/core` | domain rules and invariants | `Point` with resolved current phrasing |
| 3 | **DTO** | `@keepcv/schema` | the wire and file contract | `PointDTO`, Zod-defined, versioned |
| 4 | **View model** | `apps/web` | one screen's needs | `PointCardView` with formatted dates, computed badges |

There is a **fifth**, and it is not a layer - it is a destination:
`ResumeDocument`. It is uniform where the other four are
kind-specific, and it is what every renderer binds to. See
[`template-model.md`](template-model.md).

Rules, enforced by package boundaries:

- **Rows never leave `@keepcv/db`.** A Drizzle row type in a React component
  means storage changes become UI changes.
- **Entities never cross the network.** The API speaks DTOs, so the wire
  format is free to stay stable while the domain evolves.
- **View models never travel upward.** They are built in the browser, from
  DTOs, for one screen, and are disposable.
- **DTOs are not view models.** The temptation to add `formattedDateRange` to
  a DTO because one screen wants it is how the contract becomes a UI
  changelog. Formatting is presentation; it happens in layer 4.

**An entity type is written only when it differs from the DTO.** `Point` carries
its resolved current phrasing, which the wire shape does not have, so it earns a
type of its own. A profile, an organisation and a career record have no domain
rule the wire shape does not already express, so each has one type rather than
two identical ones and the repository port returns the DTO. Declaring every field
twice with an identity mapping between them buys nothing and drifts the first
time one side is edited.

```
PGlite/Postgres --row--> repository --entity--> domain service --DTO--> HTTP
                                                                          |
                                                                        DTO
                                                                          v
                                                    TanStack Query cache --> selector --> view model --> component
```

**The one deliberate exception:** `ResumeDocument` crosses every
layer unchanged. It is a contract in `@keepcv/schema`, produced by a pure
function in `@keepcv/core`, and consumed identically by the browser preview
and the server-side exporter. Duplicating it per layer would guarantee that
the preview and the exported file eventually disagree - which would falsify
the entire WYSIWYG premise.

---

## 2. Package responsibilities

```
@keepcv/schema   Zod definitions, DTOs, schema versioning, JSON Schema emit.
                 Zero dependencies beyond Zod. Imported by everything.

@keepcv/core     Domain entities, invariants, and pure operations:
                 - present(record) -> Entry          one presenter per record
                       kind; the ONLY place kind-specific presentation
                       knowledge lives
                 - compile(manifest | composition) -> ResumeDocument
                 - diff(versionA, versionB)
                 - canonicalise(RichText) + contentHash
                 - projectPlainText(RichText)
                 - search(store, query) and the store selectors: counts,
                       nudges and tag usage are pure functions of the boot
                       payload, so no screen asks the server a question it
                       already holds the answer to
                 - estimateLength(ResumeDocument, TemplateConfig)
                       estimate only - Paged.js in the preview is authoritative
                       for actual page count and overflow
                 - fractional sort-key arithmetic
                 - the Repository PORT (interfaces only)
                 No I/O. Runs unchanged in Node and in the browser.

@keepcv/db       Drizzle schema, migrations, repository IMPLEMENTATIONS,
                 content-ref index maintenance.

@keepcv/api      Hono routes, Zod validation, error mapping, typed client.

@keepcv/render   ResumeDocument -> HTML -> paginated -> PDF.
@keepcv/templates  Template implementations + config schemas.
@keepcv/interop  The lossy adapters - JSON Resume, RenderCV, PDF and DOCX
                 parsing. Native export/import is not here: it is a whole-store
                 read and write, so it is the store repository.
@keepcv/ats-lint ResumeDocument + rendered output -> lint report.
```

**Why `@keepcv/core` runs in the browser matters more than it looks.** It means
the resume preview is compiled *client-side* from data already in the cache -
no round trip, no debounced server call, instant feedback while dragging. The
server runs the same function over a pinned manifest when creating a version
or exporting. One implementation, two callers, and no possibility of the
preview and the output diverging.

---

## 3. State ownership in the SPA

Four kinds of state, four owners. Putting any of them in the wrong place is a
bug class, not a style preference.

| State | Owner | Persisted | Example |
|---|---|---|---|
| **Server state** | TanStack Query | in the database | records, points, resumes |
| **Draft state** | form layer + `draft` table | yes, outside history | half-written phrasing |
| **UI state** | component / router | no | which pane is open, dialog visibility |
| **URL state** | TanStack Router search params | in the URL | active filters, selected tag, search query |

**Filters and search live in the URL**, not in component state. This is not
tidiness: the moment that matters is returning after ninety days and finding
everything navigable. A filtered view you can bookmark, share
with yourself, and return to via browser history is worth more than one that
resets on reload. The query is URL state and nothing else: running it is a pure
function of the cached store (data-model.md #8), so there is no server state
behind a search box and no query key for one.

**Drafts are persisted server-side** (`draft` table, data-model.md #5). In a
product whose promise is that nothing written is lost, losing in-progress text
to a closed tab is the founding failure in miniature.

---

## 4. Query keys and invalidation

```ts
['store']                                  // whole-store boot payload
['records', kind, filters]
['record', recordId]
['points', { recordId }]
['phrasingSet', phrasingSetId]
['resumes']
['resume', resumeId]                       // working composition
['resume', resumeId, 'versions']
['resume', resumeId, 'version', versionId]
```

The store is kilobytes, so `['store']` is fetched once on boot
with a long `staleTime` and most screens read from it via selectors. There is
no sync engine and there will not be one - that is exactly the scope gravity
this project treats as its primary threat.

| Mutation | Invalidates |
|---|---|
| Record created/updated/archived | `['records', kind, *]`, `['record', id]`, `['store']` |
| Point changed | `['points', ...]`, `['record', parentId]` |
| Phrasing revision committed | `['phrasingSet', id]`, any `['resume', *]` whose preview uses it |
| Composition patched | `['resume', id]` only - **never** `['store']` |
| Version created | `['resume', id, 'versions']`, `['resume', id]` |

That last row is the one to get right: composition changes are frequent
(every drag, every toggle) and must not invalidate the store. Getting this
wrong turns a drag-and-drop interaction into a full refetch.

### Optimistic updates

Every mutation is optimistic, and **UUIDv7 identifiers are generated on the
client**. An entity therefore has its identity before the server
has heard of it, so the optimistic row is the real row - no temporary-ID
reconciliation, no key churn when the response arrives.

Conflicts use the `updated_at` token: a `409` returns current server state and
the UI surfaces a comparison rather than silently discarding either side.
Silent last-write-wins is unacceptable in this product specifically.

---

## 5. Screens and the read models they need

Designed together. A screen that needs data the model cannot serve cheaply is
a modelling problem, not a query-optimisation problem.

### 5.1 Store overview - the cold re-entry screen

The most important screen in the product for cold re-entry, and the one most
likely to be under-designed because it looks like a dashboard.

Needs: counts per record type; what changed since `owner.last_opened_at`;
recently edited records; points with no tags or no metrics; records
missing end dates; certifications expiring soon.

Served by selectors over the cached `['store']` payload, not by a summary
endpoint: every one of them is a pure function of current state, and deriving
them in SQL as well would be the same numbers computed twice
(`api-contract.md` #3). Every one is a "you left something unfinished"
affordance, which is the antidote to returning after ninety days and not
knowing where you were.

### 5.2 Record list

Needs, per row: title, organisation name, date range, point count, tag
chips, archived state.

Served by a select over `record` plus a grouped point count. The count is the
part that needs care - computing it per row in application code is an N+1 on the
most-visited list in the product.

### 5.3 Record detail

Needs: the kind's own fields; ordered points, each with canonical current text
and a phrasing count; tags; links; fields; summary phrasing set.

Served by `point_display`, which resolves the four-level
point -> set -> phrasing -> revision chain into one join.

Because points are uniform across every record kind, **this screen
is built once** and serves experience, education, projects and everything
else. Only the kind-specific field block above it differs.

### 5.4 Point / phrasing editor - the highest-risk interface

The highest-risk interface in the product: get it wrong and maintaining the
data model becomes a chore. Its state machine is #6.

Needs: all phrasings in the set with current text and char counts; which is
canonical; revision history per phrasing; metrics; evidence (visibly marked
private); confidence; tags; **where this point is currently used**.

That last item is why `resume_content_ref` exists (data-model.md #9.2).
Editing a phrasing without knowing which resumes depend on it is exactly the
anxiety this product exists to remove.

### 5.5 Resume composer

Three panes: the store with in/out toggles; the resume structure,
drag-and-drop; live preview.

Needs: the full store (already cached); the working composition; a compiled
`ResumeDocument`. Mutations are single-row patches with a fractional
`sort_key`, so a drag sends one small request (data-model.md #3.4).

### 5.6 Version timeline and compare

Needs: versions ordered by `seq desc` with trigger and snapshot label;
a structural diff between any two.

`diff(a, b)` is a pure function in `@keepcv/core` over two immutable
manifests: entries added/removed/reordered, phrasing revisions swapped,
template config changed. Because manifests are stored whole, it
needs no history replay.

### 5.7 Export and data

Needs: format list with explicit lossiness warnings; mirror status
and location; restore.

Export is never gated by any auth or entitlement state.

---

## 6. The phrasing editor state machine

The single most consequential piece of interaction design in the product, and
the reason phrasing revisions are immutable and append-only.

```
                  +--------------------------------------------+
                  v                                            |
   +--------+  focus   +---------+  content == current   +----------+
   |  Idle  |--------->| Editing |---------------------->| Discarded|
   +--------+          +---------+                       +----------+
        ^                   |  keystroke -> debounce 800ms
        |                   v
        |            +------------+
        |            | DraftSaved |   persisted to `draft`, not history
        |            +------------+
        |                   |  blur / explicit save / about to be pinned / idle 30s
        |                   v
        |            +------------+
        +------------| Committing |--> append phrasing_revision, move pointer,
             success +------------+    delete draft
```

Rules that fall out of append-only revisions:

- **Keystrokes never create revisions.** Revisions are meaningful moments; a
  history of 400 single-character revisions is not history.
- **A revision is only appended if content actually changed.** Enforced by the
  unique `(phrasing_id, content_hash)` index, so retyping a word and undoing
  it cannot pollute the timeline.
- **Pinning forces a commit.** Rendering or versioning a resume commits any
  open draft first, so a version can never pin text the user never saw.
- **Reopening with a draft present is explicit.** The editor says a draft
  exists and offers restore or discard; it never silently resurrects text the
  user believed they had abandoned.
- **The editor is bound to the AST, not to a string**. Bold, italic
  and link are the only marks; the input rejects anything else at the schema
  boundary rather than sanitising after the fact.

---

## 7. The preview pipeline

```
composition change
   +-> debounce 250ms
      +-> core.compile(composition, store)  --> ResumeDocument   [pure, client-side]
         +-> template.render(doc, config)   --> React element
            +-> mount into isolated iframe
               +-> Paged.js paginate
                  +-> page count + overflow  --> length budget indicator
```

- **The preview iframe is style-isolated.** App CSS cannot reach it. If it
  could, the preview would stop being a faithful representation of the
  exported document and the whole WYSIWYG premise would be false.
- **Compilation is client-side and pure**, so dragging an entry updates the
  preview without a network round trip.
- **Export uses the same functions**, server-side, over a pinned manifest.
  One implementation, two callers.
- **Page count feeds the length budget** rather than being discovered at
  export time - warning *before* rendering rather than after.

---

## 8. Frontend folder structure

```
apps/web/src/
  app/                  router, providers, shell, error boundaries
  features/
    records/  points/  phrasings/  resumes/
    composer/ versions/  search/  tags/  export/
      api/              typed-client query and mutation hooks
      model/            DTO -> view model selectors, local state machines
      ui/               components
      routes/           route definitions and loaders
  components/ui/        shadcn-owned primitives
  lib/                  api client, formatting, date helpers
  styles/               tokens, themes
```

Rules:

- A feature may not import another feature's internals. Shared logic moves to
  `@keepcv/core` if it is domain logic, or `lib/` if it is presentation.
- DTO -> view model mapping happens in `model/`, never inline in components.
  This keeps formatting decisions in one place per feature and out of JSX.
- **Directories arrive with something in them.** `components/ui/` appears with
  the first shadcn primitive a screen actually needs; a `routes/` directory
  appears when a feature has more than one route to put in it. An empty folder
  is a claim about where code will go that the code has not agreed to yet.
- **Routes are declared in code, not generated from filenames.** The generator
  is a build step and a watcher for a route table that fits on a screen, and the
  search-parameter schemas are Zod objects from `@keepcv/schema` either way.

### The session token

Local mode mints a token per launch and never writes it to disk. The launcher
prints a URL carrying it in the **fragment**, which no browser sends to any
server: a page on another origin that fetches this one gets the entry document
with no token in it, and nothing lands in a proxy log. The app claims it once,
keeps it in `sessionStorage` for the tab, and removes it from the address bar so
a screenshot or a pasted URL does not carry it. A fragment on a later launch
wins over whatever the tab remembered, because the older token has stopped
working.

The web app and the API share an origin - the launcher serves the built app for
everything outside `/v1` - so the client never has to be told where its store
is, and there is no CORS surface at all.
- Route loaders prefetch into the Query cache; components read from the cache.
  No component fetches directly.

---

## 9. Error, loading and empty states

Part of the Definition of Complete, not polish.

- **Errors** use RFC 9457 `application/problem+json` end to end, so the client
  renders a typed problem rather than parsing strings.
- **Loading** is skeleton-based on lists and inline on mutations. Optimistic
  updates mean most mutations have no loading state at all.
- **Empty states are content, not apologies.** The empty point list on a
  role is the moment the data-entry cold start is won or lost: it should invite
  the first entry, not report a count of zero.
- **Archived content is reachable**, never hidden. A filter toggle reveals it,
  because "where did my old bullet go" must always have an answer.
