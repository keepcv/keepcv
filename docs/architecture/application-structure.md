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
                       nudges, tag usage, draftFor(store, target), the wordings
                       a set holds and the resumes a point or a wording is on
                       are pure functions of the boot payload, so no screen asks
                       the server a question it already holds the answer to
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
to a closed tab is the founding failure in miniature. They arrive with the boot
payload and are read through `draftFor(store, target)`, so an editor knows a
draft is waiting before it opens rather than asking after it has.

---

## 4. Query keys and invalidation

```ts
['store']                                  // whole-store boot payload
['records', kind, filters]
['record', recordId]
['points', { recordId }]
['phrasingSet', phrasingSetId]
['phrasing', id, 'revisions', currentRevisionId]
['resumes']
['resume', resumeId]                       // working composition
['resume', resumeId, 'versions']
['resume', resumeId, 'version', versionId]
```

**A phrasing's history is keyed by the revision it points at.** History is the one
thing an editor needs that the boot payload deliberately does not carry, and it
only ever changes by an append that moves the pointer - so a commit lands on a
key that has never been fetched, and the list refreshes without an invalidation
of its own.

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
Silent last-write-wins is unacceptable in this product specifically. The
comparison is field by field, naming what each side says and what matched, and
it offers exactly two resolutions - save mine over it, or keep what is stored.
Neither is taken until one is chosen.

**Optimistic is about the cache, not about navigation.** The row is written into
`['store']` before the request leaves, and put back if the request is refused -
without that, a screen goes on claiming a write that never landed, and goes on
claiming it if the re-read fails too. But a mutation that *navigates* waits for
the response first: arriving on a record's page and then being thrown off it is
worse than a pause on a button that says "Saving".

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

Needs, per row: title, organisation name, date range, point count, archived
state.

Served by selectors over the cached payload, like everything else the client
reads. **Grouped by kind, in the order the kinds are declared**, which is
reading order: storage order puts Awards above Experience, and one flat list of
sixty rows is a wall.

**The kind list is navigation, not a filter bar.** It lives in the app frame
beside Overview and All records, with a count per kind, so it is on every screen
and costs no vertical space above the content. Eleven chips at the top of a list
is more chrome than list, and worst at 390px where they wrap to four rows.
Archived stays a segmented control on the list itself, because it is a mode over
what is shown rather than a place to go.

### 5.3 Record detail

Needs: the kind's own fields; ordered points, each with canonical current text,
its metrics and its tags; tags; links; fields; summary phrasing set; and the
resumes the record is placed on.

Served by selectors over the cached payload. **Every list in the app opens onto
this screen** - the record list, the overview's "where you left off", and a
search hit - because a store you can only look at is a dead end, and re-entry is
the overview's whole job.

Because points are uniform across every record kind, **this screen
is built once** and serves experience, education, projects and everything
else. Only the kind-specific field block above it differs.

Editing is a route of its own rather than a dialog, so a half-written record
survives a reload and can be linked to. **The form is built once too**: the
shared columns are laid out by hand and a kind's own columns come from a declared
table, checked against the schema so a column added to the model cannot stay
unreachable from the only screen that writes one. A kind is chosen when a record
is created and fixed afterwards, because the kind decides which columns the row
has and the store cannot move a row between them.

**An organisation is typed, not chosen.** The field suggests the names the store
already has and creates the one it does not, in the same submit; a picker with no
way to add would leave every employer unnameable until some other screen existed.
Matching is case-insensitive on the trimmed name, so retyping an employer does
not make a second one.

**Archiving is the only removal, and it reverses from the same button.** It is on
the record, not on the list: a destructive-looking control on a row is one a
mis-tap reaches.

### 5.4 Point / phrasing editor - the highest-risk interface

The highest-risk interface in the product: get it wrong and maintaining the
data model becomes a chore. Its state machine is #6.

Needs: all phrasings in the set with current text and char counts; which is
canonical; revision history per phrasing; metrics; evidence (visibly marked
private); confidence; tags; **where this point is currently used**.

That last item is why `resume_content_ref` exists (data-model.md #9.2).
Editing a phrasing without knowing which resumes depend on it is exactly the
anxiety this product exists to remove.

**Points are also a destination of their own**, listed with the record each is
filed under, its metrics, its tags and how many resumes print it. The point is
the atomic unit; a store that can only be browsed through records hides the one
thing every resume is assembled from. Its filters are the overview's nudges made
reachable - unplaced, and no metric - so a count on the overview is a link
rather than a number nobody can act on.

**A point is created with the words it holds**, in one request: the set, the
phrasing and the first revision are the store's to write together, and a point
that exists but says nothing is not a state worth being able to reach. Creating
one is the only screen that writes text through a form; every later change to
what a point says goes through the editor, so the create form is a plain box and
the point's own screen is the editor.

**Changing what a point says appends**, and the editor decides when. Its state
machine is #6. The store mints the revision's id, unlike every other create,
because the content hash is what makes an append idempotent and a second id
would be a second answer to "which revision is this". The optimistic cache
therefore rewrites the current revision row in place: the boot payload narrows
revisions to what each phrasing currently says, so that row is that projection,
and the re-read brings back the new revision's own id.

**A set holds more than one wording and points at one of them.** A variant is
added from the wording it varies rather than from an empty box, since a phrasing
that says nothing is not a state worth reaching. Switching which is canonical is
one row on the set and changes nothing a resume already pinned - that is the
whole reason an entry pins a phrasing rather than a set. The canonical wording
cannot be archived, because a set with nothing to say has no text for any screen
to show.

**Nothing on that screen navigates when it saves.** The wording commits itself,
metrics save as they are added, and only the filing - record, confidence, date -
has a Save button. A point is a place you stay and work, not a form you submit;
arriving somewhere else because a textarea lost focus would be worse than any
saving indicator.

**Metrics are written as they are added, not staged with the rest of the screen.**
A metric belongs to a point that already exists, so there is nothing to roll
back and nothing to save; the panel says so, because a Save button above it would
otherwise look like it covered them.

**"Where this is used" is a selector, not a request.** The resumes a point is on,
and the resumes that pinned one particular wording, are both derivable from the
boot payload the screen already holds. The per-wording answer is the one the
editor needs: editing a variant nothing printed changes nothing, and saying
otherwise would manufacture the anxiety this screen exists to remove. The
`/v1/points/{id}/usage` route answers a different question - which *versions*
pinned it - and is for the timeline.

### 5.5 Resume composer

Three panes: the store with in/out toggles; the resume structure,
drag-and-drop; live preview.

Needs: the full store (already cached); the working composition; a compiled
`ResumeDocument`. Mutations are single-row patches with a fractional
`sort_key`, so a drag sends one small request (data-model.md #3.4).

Reading comes before dragging: the screen is **composition and preview, toggled**,
and both halves answer from the cached payload. Composition shows every row the
selection holds - including the ones toggled off, dimmed and marked, because off
is a state the selection exists to hold and a row that vanished would read as a
delete. It shows the **wording this resume chose**, since an entry point pins a
phrasing rather than a set. Preview runs `compile()` in the browser, which is the
whole reason `@keepcv/core` does no I/O: the preview and a server-side export are
the same function over the same manifest.

An entry links back to its record, and a record's "where it appears" links here,
so the two directions of "what does this affect" both resolve.

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
- **Nothing runs until the user types.** The timers start on the first
  keystroke, not on open. An editor that started them on open would reach
  "content == current" while the offer above was still unanswered, and throw the
  draft away before the user had read it.
- **A draft holds the field it will commit to.** It is stored under the
  `body` field of the phrasing and carries a `RichText` value, so the AST-bound
  editor writes exactly what the plain one does. The `draft` table is
  deliberately unvalidated (data-model.md #5), so a body this build does not
  recognise reads as no draft rather than as a crash on the screen that opens it.
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

**The app ships as one chunk, and the warning limit says so.** The launcher
serves it over loopback beside `/v1`, so the whole bundle is one local read and
splitting it by route would buy a suspense boundary per screen and no measurable
time. The limit in `vite.config.ts` is set above today's size rather than
removed, so it still trips on a real regression. The split worth making later is
this pipeline: Paged.js and the templates are large, are needed on one screen,
and are the first dependency in the app that a user might never load at all.

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
  lib/                  api client, the store cache, formatting, date helpers
  styles/               tokens, themes
```

Rules:

- A feature may not import another feature's internals - its `ui/` and its
  `api/`. A feature's `model/` is its interface for the concept it owns, so the
  point form naming a record uses the records feature's row model rather than
  writing a second one. Anything neither feature owns moves to `@keepcv/core` if
  it is domain logic, or `lib/` if it is presentation: the boot payload's cache,
  the optimistic-mutation helper every feature writes through, sort-key
  arithmetic and partial-date formatting are all `lib/`.
- **A date reads the same on a screen as on a resume, so it is formatted once.**
  `lib/partial-date.ts` binds `core.formatPartialDate` to the app's locale and
  adds nothing else; the app's chrome is English and untranslated, while a
  resume's locale is a per-resume option `compile()` takes, so the two callers
  differ only in which locale they pass. **A *period* is not the same fact.** A
  screen says `2019 -` to show a record nobody has finished and `until Apr 2024`
  when only an end is known, because leaving a record open is a state the
  overview nudges about; a resume must print neither. So `formatPeriod` has one
  version per contract and the date inside it has one version full stop. **A
  moment is a third fact**: `lib/timestamp.ts` formats the instants the store
  recorded - when a revision was written - which no resume ever prints, so it
  binds nothing from `core` and shares nothing with either of the above.
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
  No component fetches directly. **The loader is on the root route**, because the
  frame itself navigates by what the store holds: one payload serves the shell
  and every screen under it.
- **Search is a screen, and its field is in the frame.** `search(store, query)`
  answers from the cache, so the URL is updated on every keystroke and replaced
  rather than pushed - a search is one history entry, not thirty. `/` focuses the
  field.

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
