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
                       nudges, tag usage, tagForLabel(store, label),
                       draftFor(store, target), the wordings a set holds and the
                       resumes a point or a wording is on are pure functions of
                       the boot payload, so no screen asks the server a question
                       it already holds the answer to
                 - paginate(blocks, usable) and lengthBudget(doc, pages, limit)
                       fed real geometry by whatever laid the document out,
                       so the answer is measured rather than estimated (#7)
                 - targetMatch(store, resumeId): what the posting asks for,
                       which of it the resume answers, and which placed point
                       answers least (#5.6)
                 - fractional sort-key arithmetic
                 - the Repository PORT (interfaces only)
                 No I/O. Runs unchanged in Node and in the browser.

@keepcv/db       Drizzle schema, migrations, repository IMPLEMENTATIONS,
                 content-ref index maintenance.

@keepcv/api      Hono routes, Zod validation, error mapping, typed client.

@keepcv/render   ResumeDocument + the template it names -> one self-contained
                 HTML file. No PDF writer and no headless browser: the file
                 carries the template's own `@page` rules, so the printing
                 engine is the PDF exporter (#7.1). Runs in Node and the
                 browser, like core.
@keepcv/templates  The template contract, the shared fixture that defines what
                 passing it means, and the templates themselves.
@keepcv/interop  The lossy adapters - JSON Resume, RenderCV, PDF and DOCX
                 parsing - each with a loss report counted against the resume
                 in hand (#7.3). Native export/import is not here: it is a
                 whole-store read and write, so it is the store repository.
@keepcv/ats-lint ResumeDocument + the rendered file -> lint report. Pure, and
                 depends on nothing but schema: the caller renders (#7.2).
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
['resume', resumeId, 'versions']
['resume', resumeId, 'snapshots']
['resume', resumeId, 'version', versionId]
['resume', resumeId, 'diff', a, b]
```

**There is no key for the working composition.** It is `composition(store, resumeId)`
over the boot payload, for the reason there is no route for it (`api-contract.md`
#3): every row it resolves is already cached. A key here would be the same rows
fetched twice and a second thing to keep in step.

**A phrasing's history is keyed by the revision it points at.** History is the one
thing an editor needs that the boot payload deliberately does not carry, and it
only ever changes by an append that moves the pointer - so a commit lands on a
key that has never been fetched, and the list refreshes without an invalidation
of its own.

**A diff is keyed by the pair and never goes stale.** Two versions are immutable,
so `staleTime` is infinite: what they say differently was decided the moment the
second one was captured.

The store is kilobytes, so `['store']` is fetched once on boot
with a long `staleTime` and most screens read from it via selectors. There is
no sync engine and there will not be one - that is exactly the scope gravity
this project treats as its primary threat.

| Mutation | Invalidates |
|---|---|
| Record created/updated/archived | `['records', kind, *]`, `['record', id]`, `['store']` |
| Point changed | `['points', ...]`, `['record', parentId]` |
| Phrasing revision committed | `['phrasingSet', id]`, any `['resume', *]` whose preview uses it |
| Composition patched | nothing - the answer is written into `['store']` |
| Resume renamed, archived, retemplated or recapped | nothing - the answer is written into `['store']` |
| Version created | `['resume', id, 'versions']` |
| Version starred | `['resume', id, 'snapshots']` |
| Version restored | `['resume', id, 'versions']`, `['store']` |

**A composition write settles by merging its answer, not by invalidating.** A
toggle, a move, a placement and a wording choice each write one row and the
response *is* that row, carrying the `updated_at` the next write has to present.
Writing it into the cached payload is therefore exact, and re-reading the whole
store per drag would be a request that could only tell the client what it already
knows. `useStoreMutation` takes a `settle` for this; a mutation without one falls
back to invalidating, because its answer does not cover everything it changed -
creating a record may also have created an organisation.

**A restore is the one write with no optimistic patch at all.** It rewrites
sections, entries, points, contact overrides and the target context in one
transaction, and the client cannot know which of those the store actually
changed - so the boot payload is re-read rather than guessed at. It is also rare
enough that the round trip costs nothing anyone notices, which is not true of the
row above it.

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

**Evidence is written on this screen, and the screen says it never leaves.**
Metrics and evidence are both sub-collections of a point that already exists, so
both are saved as they are added rather than staged, and removing one archives it.
The difference is what the panel has to communicate: evidence is private
*structurally* - `ResumeDocument` has no field it could travel in
(template-model.md #2) - and a user who does not believe that will not write down
the thing worth writing down. The panel says so where the rows are, not in help
text. A `url` renders as a link only when it parses as `http` or `https`; a path,
a half-typed address or any other scheme is shown as text, because the value is
the user's own note and not a URL field.

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

### 5.5 Tag vocabulary

Needs: every tag with what it carries on both sides, live and archived; and the
one label a new tag would collide with.

**A tag is created from wherever the word is being used.** The picker on a record
and on a point takes a label rather than an id: an existing tag is reached for and
a new one is created and assigned in the same motion, so filing work under a word
never starts with a trip to a management screen. What decides which of the two
happens is `tagForLabel(store, label)` in `@keepcv/core` - two labels that slug
alike are one tag, and `tag_slug_unique` refuses the second (data-model.md I17).
The picker names the tag it would have collided with rather than showing the
constraint.

**The vocabulary screen is where a tag is renamed, merged and put aside.** Merging
is the reason a vocabulary of eighty stays usable: it moves everything the losing
tag carried onto another one and archives it, so no assignment is lost with the
name. Its counts link to the lists narrowed by that tag, which is what makes
"0 records, 0 points" actionable rather than trivia.

**Saved filters sit above the list they narrow**, not on a screen of their own:
a saved filter is a shortcut back to a list, so it lives where that list is. The
row keeps what the narrowing means rather than the vocabulary of the control
that made it (`data-model.md` #8.1), and a filter already naming what is on
screen is said so rather than offered for saving a second time. Forgetting one
archives it, like every other owned row.

**Archived tags are offered nowhere but their own filter.** Assigning one would
put a hidden word on a live row, so the picker refuses and says where to put it
back - the alternative, restoring it silently, is a write the user did not ask
for.

### 5.6 Resume composer

Three panes: the store with in/out toggles; the resume structure,
drag-and-drop; live preview.

Needs: the full store (already cached); the working composition; a compiled
`ResumeDocument`. Mutations are single-row patches with a fractional
`sort_key`, so a drag sends one small request (data-model.md #3.4).

The screen is **composition and preview, toggled**, and both halves answer from
the cached payload. Composition shows every row the selection holds - including
the ones toggled off, dimmed and marked, because off is a state the selection
exists to hold and a row that vanished would read as a delete. It shows the
**wording this resume chose**, since an entry point pins a phrasing rather than a
set. Preview runs `compile()` in the browser, which is the whole reason
`@keepcv/core` does no I/O: the preview and a server-side export are the same
function over the same manifest.

**Adding and taking off are one control, because placing is a create or a
put-back.** Every uniqueness index on the composition covers archived rows
(`data-model.md` #9.1), so a record taken off a section and added again is the
row that is already there, restored. The picker offers what is not currently
placed and the write decides which of the two it is; a second "removed" list
beside it would be the same rows shown twice.

**Moving is one row and one request.** `keyForPosition` in `@keepcv/core` answers
the fractional key a row takes at a position, clears any key an archived row in
the gap still holds, and answers `undefined` when the row is already there - so a
move that changes nothing writes nothing. Ordering compares keys **by code unit,
never by locale**: a row moved above the first one takes a key in the upper-case
magnitude, and `"Zz".localeCompare("a0")` is positive.

An entry links back to its record, and a record's "where it appears" links here,
so the two directions of "what does this affect" both resolve.

**Contact visibility is three-valued**, not a checkbox: on, off, or the channel's
own default. Following the default again clears the override row rather than
writing `true` into it, so changing the channel's default later still reaches
this resume.

**The resume row itself writes here too** - created from the list with nothing
but a name, renamed in place, archived and put back from its own header. A
template chosen on the resume screen is a patch like any of those, and because
the choice is a column the preview follows it through the boot payload rather
than through a second piece of state.

**Only the overrides are stored.** A settings panel reads `template.fields` and
writes back what differs from the template's own defaults, so a default that
moves in a later version moves with it (template-model.md #5). The write is
debounced: each patch carries the row's `updatedAt`, and a slider that wrote per
pixel would race its own answers into a conflict.

**How long it may be is a column, not a template setting.** `page_limit`
survives a template swap and travels with the export, because "this application
wants one page" is a fact about the application rather than about typography.
Null means no limit and is the default: a resume that nags before the user has
said what they are aiming at is a resume that nags for nothing.

### 5.7 Resume target

The resume screen's second view, between composition and preview. Needs: the
application's own facts - company, role, posting URL, applied date - and the
posting text itself; then what the posting asks for and how much of it the
resume answers.

**The form is staged, not written as it is typed.** Every other write in the app
is optimistic and immediate; this one is not, because a posting is pasted in one
motion and the panel below it re-ranks on every keystroke otherwise. Save sends
one patch carrying the whole form, so Revert can clear a field - an absent key
would leave the stored value alone. A `409` opens the same comparison the record
form uses, with the posting reduced to a length: two pages of prose side by side
is not a comparison anyone reads.

**`targetMatch(store, resumeId)` in `@keepcv/core` is what reads it.** It ranks
the terms the posting leans on by how often it says them, weighting up any the
store already files work under; marks each as answered or not by what the resume
actually prints; and scores every visible placed point against them, weakest
first. The role counts as part of the posting, so a resume with no pasted text
still says what it is for.

**It is deliberately shallow, and says so.** Term frequency over a stopword list,
prefix matching bounded to an inflection, no stemmer and no model. The answer it
gives is a list of words with a covered flag, which the user can check against
the posting in front of them - not a score they would have to trust. Where it is
wrong it is wrong visibly: "mentoring" does not find "mentored".

**Dropping is toggling off, not removing.** The weakest points are listed with
the record each sits under, and taking one off the page writes `is_visible`
false on the entry point. Nothing is archived and nothing is deleted, so the
selection still holds what was chosen and where it sat.

### 5.8 Version timeline and compare

The resume screen's fourth view, beside composition, target and preview. Needs: versions
ordered by `seq desc` with the trigger and, for a restore, the number it came
from; a structural diff between any two; a Save and a Restore.

`diffManifests(a, b, revisions)` is a pure function in `@keepcv/core` over two
immutable manifests: sections, entries and points added, removed, moved or
changed. Because manifests are stored whole it needs no history replay, and
because the two are immutable the answer is cacheable forever.

**It is reached through a route rather than a selector**, unlike `composition()`
and `search()`, and for the reason those two are not: manifests are the one thing
the boot payload deliberately does not carry. The revisions a manifest pins are
resolved to text server-side, so a diff arrives readable rather than as a list of
ids the client would then have to fetch.

**Only what differs is in the answer.** Two versions that print the same produce
three empty lists. `moved` is measured against the other rows that are on both
sides, not against raw indices, so inserting one entry at the top does not report
every entry below it as having moved and bury the one thing that happened.

**A point is named by its words**, having no title, so a reworded point shows the
change and nothing else - printing the new wording as a heading above a line that
already contains it says the same sentence twice.

Restoring is a button per row and the newest is not restorable, since restoring
what a resume already says is a no-op the user would have to be told about.

**Starring asks for a name.** A snapshot is a version the user marked, so it is a
row with a label rather than a flag, and unstarring archives it like any other
owned row. Snapshots are in the archive rather than the boot payload, so the
screen fetches them beside the versions.

### 5.9 Export and data

Built. Two panels: take a copy, and put one back. The copy is `GET /v1/export`,
which is the archive rather than the boot payload - superseded wordings and
every version come with it - written to a file from the tab that read it. Putting
one back is `POST /v1/import`, all or nothing and only into a store nothing has
been written to yet, because merging two career histories needs a review step in
front of it.

**What it would carry is counted, not described.** "Everything" is what every
backup screen says and the sentence nobody believes; "2 records, 3 points, 1
resume" is one somebody reads. The same panel says whether a load would be
refused, before a file is chosen rather than after.

**The mirror belongs to the launcher, not to the API.** `keepcv serve` writes a
readable copy of the whole store beside the data directory as it starts, on a
timer, and as it stops, skipping the write when the store says exactly what the
file already says. It is written whole and moved into place, so a crash mid-write
leaves the previous copy rather than half a file. `keepcv backup` and
`keepcv restore` are the same two things without a browser open. There is no
`/v1/backup/*`: those routes would have handed `createApi` a filesystem
(`api-contract.md` #3).

Export is never gated by any auth or entitlement state.

### 5.10 Profile

The header of every resume this store compiles, and the only place it comes
from. Identity fields stage and save as one patch, like the resume target and
for the same reason - four fields that read as one line, with a `409` comparison
shared with the other two forms.

**Contact channels write as they are typed**, like a metric on a point: a channel
is a row of a profile that already exists, so there is nothing to stage and
nothing to roll back. The panel names email and phone when neither is there,
which is the finding the linter would otherwise raise on the preview screen,
after the resume is built.

**The summary is a phrasing set like a point's**, so it gets variants, drafts and
an append-only history for free. A profile that never had one names no set, and
there is nowhere to type until one is made: starting it creates the set and
points the profile at it in one write.

### 5.11 Resume list

Rows and a control to start one. **A resume can also be started from another**:
`derivePlan(store, resumeId, into)` in `@keepcv/core` answers every row a copy
needs and `POST /v1/resumes/{id}/derive` writes them in one transaction, because
a half-copied resume is a resume. The plan is applied through the methods a
composition write already uses, so no repository method is added - the same
shape as a restore.

**The composition, the template and every toggle come across; the posting does
not.** A derived resume is aimed at a different opening, and inheriting the old
company would put the wrong posting behind the match on the new one. Live rows
only: an archived row is one the user took off, and copying it would either put
it back or start the copy holding something already removed.

The name is asked for rather than defaulted silently, because two resumes called
the same thing is the state this is most likely to produce and the hardest to
unpick later.

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
               +-> measure the laid-out column  --> FlowBlock[]
                  +-> core.paginate(blocks, usable)   --> page of every key
                     +-> core.lengthBudget(doc, ...)  --> what is past the limit
```

- **The preview iframe is style-isolated.** App CSS cannot reach it. If it
  could, the preview would stop being a faithful representation of the
  exported document and the whole WYSIWYG premise would be false. The template
  supplies the only stylesheet in that document, which is why `styles(config)`
  is on the contract rather than the markup carrying classes the host defines.
- **The template renders at its real size and the host scales it.** A page is
  `210mm` wide because that is what it is; the frame measures what the template
  laid out and applies one `transform` to fit the panel. Restyling to fit would
  make the preview a different document from the printed one.
- **Compilation is client-side and pure**, so dragging an entry updates the
  preview without a network round trip.
- **Export uses the same functions**, server-side, over a pinned manifest.
  One implementation, two callers.
- **Page count feeds the length budget** rather than being discovered at
  export time - warning *before* rendering rather than after.
- **The browser lays the document out and `@keepcv/core` fills the pages.** The
  frame walks the column it just rendered and reports one `FlowBlock` per box -
  its offset, its height, and whether the stylesheet said `break-inside: avoid`
  or `break-after: avoid`. `paginate` then fills pages from that geometry: a
  block that may not be broken and will not fit moves whole, and everything
  after it shifts with it. The rules come from the template's own stylesheet
  through `getComputedStyle`, so the host declares no break behaviour of its own
  and the printer reads the same declarations.
- **A pagination library was the alternative and lost.** Paged.js fragments the
  DOM into page elements, which means fighting React over the tree it owns,
  re-running on every keystroke, and shipping several megabytes with a
  deprecated transitive dependency - and none of it could be tested, because the
  suite runs in jsdom, which has no layout. Splitting it the way above puts the
  arithmetic in a pure function with real tests and leaves the host with a DOM
  walk short enough to read. What is given up is fragmenting the preview into
  separate sheets: the frame draws a labelled rule where each page begins
  instead.
- **The page box comes from the template, as a CSS length.** The stylesheet sets
  `--kc-page-content-height` on `:root`, the frame resolves it by laying out a
  throwaway probe, and no unit arithmetic happens in the host. A template that
  does not declare it fails `isATemplate`.

**The app ships as one chunk, and the warning limit says so.** The launcher
serves it over loopback beside `/v1`, so the whole bundle is one local read and
splitting it by route would buy a suspense boundary per screen and no measurable
time. The limit in `vite.config.ts` is set above today's size rather than
removed, so it still trips on a real regression. The split worth making later is
this pipeline: the templates and the exporter together are the largest thing in
the bundle, are needed on one screen, and are the first thing in the app that a
user might never load at all.

### 7.1 Taking the resume away

`renderHtml(document)` in `@keepcv/render` resolves the template the document
names, inlines that template's stylesheet, and returns one HTML file. That is
the whole exporter. It runs wherever a `ResumeDocument` does, so the app calls
it on the document it already compiled in the tab - no request, and it works
with the store stopped - and `keepcv render` calls it on one it compiled from
the store on disk. Both produce the same bytes, because there is one function.

**The file fetches nothing.** `isATemplate` already refuses a stylesheet that
`@import`s or names an address, and the exporter's own suite asserts the file
adds no address the template did not print. A resume mailed to someone who
opens it offline has to look like the resume that was sent.

**The browser is the PDF writer.** The stylesheet the file carries states
`@page`, its physical units and its break rules, so the printing engine
paginates the same geometry `paginate` measured - and it fragments the DOM
properly, which is exactly what the preview declines to do. Print goes through a
hidden `iframe` carrying that file, so the dialog opens on the document the
download would have written rather than on the app around it. There is no
headless browser here and no PDF library: either would be a second layout engine
to keep in step with the first.

**`paginate` and the printer answer the same question at different times.** The
first warns while the resume is being composed; the second is what actually
produces the file. Where they disagree the printer is right, which is why the
length budget is a warning rather than a gate.

### 7.2 Reading it back the way a machine would

`lint({ document, html })` in `@keepcv/ats-lint` answers a `LintReport`: a list
of findings and a tier derived from them. It takes both because half the checks
are about what the resume says - a missing email address, a heading nothing will
file, a date with no year in it - and half are about what the template did with
it - columns, floats, coordinates, images, words that exist only in a stylesheet.

**It takes the file rather than producing one.** The caller has already rendered
by the time it wants a verdict, and taking the bytes means the thing being linted
is the thing being sent. It also keeps the package pure: no React, no dependency
on `@keepcv/render`, and a rule suite that can be handed markup no template would
ever emit. The preview panel and `keepcv render` both call it, so the answer is
the same on either side.

**The file rules are static.** They read the constructs the stylesheet declared,
not the boxes a browser painted, which is the only thing available where there is
no layout engine. They are therefore limited to constructs that move the words
every time, and the remedy each one names is a different template rather than a
different resume. The linter is deliberately the thing that lets a user compare
templates on something other than looks.

**A tier is derived and never asserted.** `clean` is the absence of findings,
`readable` means warnings only, `at-risk` means something will not survive. There
is no claim of compatibility with any named commercial system anywhere in the
product, and the panel says as much beside the findings. A template's own
`complianceNotes` sit in a separate panel and are observations about the
template, not a verdict on the resume.

Dates are checked on record fields and not on an entry's period: a period's text
is formatted by `renderManifest` and always carries its year, and a field is
whatever the user typed. Adding a rule is an id in `LINT_RULES` plus an entry in
`DOCUMENT_RULES` or `OUTPUT_RULES`; there is no route and no table, for the same
reason `search` has neither.

### 7.3 Somebody else's format

`toJsonResume(document)` in `@keepcv/interop` writes the resume as JSON Resume
v1.0.0. It reads a `ResumeDocument` and not the store, because that format
describes a resume and a store is a career history; and it is a function rather
than a `?format=` on `/v1/export` for the reason `renderHtml` is a function -
the caller is holding the document already.

**It maps only what the format has somewhere to put.** Nine record kinds have a
list over there; anything else - a custom section, a talk - has none, and is
dropped rather than forced into an array that means something different. Dates
travel as the partial dates the record holds, which are ISO 8601 already;
`period.display` is ours and never leaves.

**`lossOf(document)` is counted against this resume**, not written as a standing
disclaimer. Three metrics, two sections with nowhere to go, one renamed heading:
a warning naming those is one somebody reads, and anything with a count of zero
is not in the list at all. The app shows it beside the button, before the file
is written, because a declared loss the user reads afterwards is not a declared
loss.

The direction that writes to the store - import, and the reconciliation
interface every import goes through - is not built.

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
  components/icon/      the glyph registry and the spot illustrations
  components/ui/        the primitives every screen is built from
  lib/                  api client, the store cache, formatting, date helpers
  styles/               the token layer, light and dark
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
- **Directories arrive with something in them.** A primitive appears in
  `components/ui/` when a screen actually needs it; a `routes/` directory
  appears when a feature has more than one route to put in it. An empty folder
  is a claim about where code will go that the code has not agreed to yet.
- **Routes are declared in code, not generated from filenames.** The generator
  is a build step and a watcher for a route table that fits on a screen, and the
  search-parameter schemas are Zod objects from `@keepcv/schema` either way.

### The session token

Only in token mode; `api-contract.md` #6 has the other two. It mints a token per
launch and never writes it to disk. The launcher
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

## 10. The design system

### 10.1 Screens name meaning, never colour

`styles/app.css` declares two layers. Underneath are the raw ramps - `ink`,
`brand`, `accent` and the status trio - and above them semantic tokens:
`surface`, `surface-raised`, `surface-sunken`, `line`, `text`, `text-muted`,
`text-subtle`, `brand`, `positive`, `caution`, `critical`, `focus` and `paper`.
**A screen names the second layer only.** A screen that writes `bg-white` or
`text-ink-500` is a screen that will not flip, and forty of them did.

The semantic block is `@theme inline`, so the generated utility emits
`background-color: var(--surface)` rather than a resolved colour. That
indirection is the whole mechanism: `.dark` reassigns the variables and every
utility follows.

`paper` is the odd one out and is deliberately quiet in both schemes. It is the
ground a rendered document sits on, and bold chrome around a resume is chrome
competing with the resume.

**The canvas is a warm ivory, a real step below the white it holds.** It sat
1.5% of lightness from `surface`, with a 1px shadow at 5% opacity underneath, so
a panel read as a hairline rectangle rather than an object on a ground. The step
is now about 3%, `shadow-card` is two layers - a tight contact shadow that seats
the edge and a wider ambient one that lifts it - and both are tinted warm. The
`ink` ramp keeps the lightness the cool one had, so every text-on-surface
contrast ratio is unchanged; only hue and chroma moved, and the hue drifts warmer
as it darkens, which is what keeps a shadow brown rather than blue.

**There is no webfont.** A store whose whole claim is that it never leaves the
machine must not fetch a font on first paint. Display type is the same sans at a
larger size, heavier weight and tighter tracking.

### 10.2 The scheme is applied before first paint

The choice - `system`, `light` or `dark` - is in `localStorage`, and an inline
script in `index.html` reads it and sets the class before the bundle loads.
Doing it in an effect flashes a white page on the way into a dark one. The key
and the vocabulary therefore appear in both that script and `lib/theme.ts`,
which cannot import each other, so a test feeds both the same values.

The choice lives on the shell rather than inside the toggle: the rail and the
narrow header each render one, and two hooks let them disagree.

### 10.3 Icons are keyed by meaning

`components/icon/glyphs.ts` maps a name this product uses - `record`, `point`,
`lint`, `budget` - onto a lucide component. Screens name the left-hand side, so
changing the drawing for a point is one line and no screen mentions a vendor.
The union of those keys is the `Icon` component's `name` type, so a typo fails
the build.

Larger illustrations for empty states are hand-drawn in `components/icon/spot.tsx`
against the same tokens. They are not icons and lucide has no vocabulary for
"nothing is ever deleted".

An icon is `aria-hidden` unless it is given a `label`, because an icon beside
its own text is announced twice.

### 10.4 Three screen shapes, not one

Every screen used to be a stack of bordered boxes in a centred column, which is
why the canvas went unused and why a two-pane task looked like a one-pane one.

- **Browse** - records, points, tags, sections, resumes. Full width, a
  `PageHeader`, then a sticky `Toolbar` carrying the archived scope and the
  saved filters. `Toolbar` sticks to `main`, which is the scroll container.
  It is a rule with the controls on it rather than a panel around them: every
  one of them holds a single pill group that already looks like a control, and
  a bordered card made that a box inside a box with most of the row empty.
  **What fills the rest of the row is the count**, because that is what a
  narrowing produces and the only other way to read it was to count the rows.
  It goes there and nowhere else - it used to be a page header's blurb on one
  screen and a panel's own title on two more, which left three screens with no
  description and two panels titled "7 shown".
- **Detail** - a record, a point. Two columns above `xl`: what the thing says on
  the left, what it is filed under and where it prints on the right.
- **Workspace** - the resume. Full height, no page scroll, panes scrolling
  independently: the composition on the left and the compiled preview on the
  right. A preview reached by leaving the screen that changes it is a preview
  nobody watches while composing.

Forms and prose are capped rather than full width. Using the whole canvas is
right for a list and wrong for a name field.

**A browse screen declares its width, and `PageBody` is the only thing that sets
one.** `reading` caps the column and centres it; `full` does not. The rule is
what the rows carry:

- **`reading`** - points, resumes, tags, sections, the profile, search. One-line
  rows with a title and a little metadata.
- **`full`** - records, the overview. Rows dense enough to earn the canvas, and
  they restructure so nothing has to be read across it.

The second half of that is the load-bearing part. Laid out as four columns at
full width, a record row put its period and its point count a thousand pixels
from the title they belonged to; the eye cannot associate them at that measure,
and the screen reads as empty and unscannable at the same time. A full-width row
therefore stacks - a kind glyph, the title with its counts beside it, and the
organisation, subtitle and period on a second line under it - so everything about
one record is against the left edge and only the reorder controls sit in the
right gutter. A group heading carries a rule to its right rather than leaving the
width blank.

The shell is `h-dvh` with `main` as the scroll container, which is what gives a
workspace a definite height to fill.

**A pane's own layout is a container query, not a viewport breakpoint.** The
preview renders both full width on its own tab and in half a workspace; keyed to
the viewport it reserved a 15rem sidebar in both and left the page unreadable in
the second.

**What is about the resume is not in the resume, and it lives on the preview
tab.** Export, the ATS findings, the page limit and the template's own settings
are one column beside the paper, grouped as "Take it with you", "How it reads"
and "How it looks", and it collapses so the page can have the whole pane. Wide
enough for two columns, each scrolls on its own - reading down a resume must not
carry the settings off the top.

Beside the composition that column is **absent, not collapsed**. There the
preview is feedback on what was just placed, and a panel of export and template
controls opens over the thing it changes; every arrangement that keeps it - under
the paper, or floating above it - is either invisible or in the way. The page
count stays, because that is feedback. Changing the template is a click away on
the tab whose job it is.

### 10.5 What a control looks like is a claim about what it does

**`danger` is for losing something, and archiving is not that.** Six screens
painted Archive in critical red. Nothing in this product is destroyed - archiving
is the reversible safety net the whole store is built on - and red is the
universal signal for the opposite, so the styling taught users to fear the
mechanism that keeps them safe. Archive is a secondary button carrying the
`archive` glyph, and `Put back` carries `restore`. `danger` is left on the two
actions that genuinely cost something: merging a tag, which moves everything off
the losing one before archiving it, and discarding a draft, which throws away
text that was never committed.

**A form that is not being filled in is not on the screen.** A record's links and
fields each had three empty inputs open permanently with the button that submits
them underneath, so the panel read backwards and two-thirds of a record's screen
was blank boxes. They sit behind the control that names them - `Add a link`,
`Add a field` - and open as a bounded block with its own confirm and cancel, so
the submit button belongs to something visible. That is the same shape the resume
list already used for naming a new resume.

**A repeated row action is a glyph, and it keeps the label that names its row.**
`Hide` and `Remove` spelled out on every section, entry and point put two words
of chrome beside every line of the user's own content. Each still passes `label`,
because `Up` on its own tells a screen reader nothing about which row moved.

Beware `aria-*` passed into a component that does not forward it: TypeScript does
not excess-check a hyphenated JSX attribute, so `aria-expanded` on `Button`
type-checked and was dropped on the floor. `Button` takes `expanded`.

**"You are here" is a marker in the margin, not a filled block.** The rail's
active row was a solid brand pill - the only colour on it - so the one row the
user had already reached shouted over the eleven they had not. It is a recess
plus a two-pixel brand rule at the left edge, which is quieter and also lines the
rows up down a single column. A group heading carries a rule to its right, the
same device the record list uses.

The whole marker is declared in the active class rather than being coloured in
from a transparent one in the base: the router **appends** `activeProps.className`
instead of merging it, so both `before:` colours land on the element and the
stylesheet's own order decides - which it did, in favour of transparent, leaving
no marker at all. The row itself is one function used by the links and by
`Sign out`, which had carried its own copy of the classes.

**A control does not move when its container resizes.** The collapse button used
to sit beside the brand when the rail was open and jump to a row of its own when
it was not, and the scheme toggle was dropped entirely below `w-16` - so the only
way to change the scheme on a wide screen was to widen the rail again. Both live
in a footer strip present in both states, and the toggle stacks vertically when
the rail is narrower than three buttons in a row.

### 10.6 The palette

`Ctrl-K` or `/` opens a palette over `search(store, query)` - the same selector
the search screen reads, so the two cannot disagree about what matches. It
offers destinations and creates before anything is typed, the first few records
and points once something is, and a row that opens the whole result list, which
is also the only way to reach an archived hit from it.

The dialog moves focus to its first focusable element on open **only when
nothing inside has claimed focus already**. The close button is that first
element, so focusing it unconditionally took focus back from the palette's field
and swallowed everything typed after opening.

### 10.7 Arriving without a credential

`main.tsx` awaits `GET /auth/mode` before the first render, because which of
three screens belongs here is not a thing to decide twice, and an effect that
decided it later would flash the wrong one. **In none of the three does the
router mount** - every route under it would only render the same 401.

| mode | with nothing to send |
|---|---|
| `token` | the landing page |
| `password` | the sign-in screen |
| `proxy` | a panel saying the upstream named nobody, which is a proxy misconfiguration and not something to retry here |

A credential that is present and refused is a different case, and the app's own
failure state says what to do about it. Signing out is a nav item rather than a
mode the shell knows about: the router context carries `signOut` or carries
nothing, so the navigation asks whether signing out is a thing here.

The landing page is also the marketing surface, and it names the things that
were otherwise buried a level or two inside the app: the linter, the length
budget, reading a posting, version history, phrasing variants, and what JSON
Resume cannot carry.
