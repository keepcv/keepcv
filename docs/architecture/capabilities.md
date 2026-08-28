# Capabilities and Delivery

> What KeepCV will contain, the order it gets built in, and what "done" means.

---

## 1. Definition of Complete

Work lands **complete**. There is no half-built state in `main`: a change
either delivers behaviour someone can use end to end, or it does not merge.

- [ ] Schema and migration merged, expand/contract compliant
- [ ] API routes with Zod validation and `problem+json` errors
- [ ] Repository methods implemented and covered by the contract suite
- [ ] UI covers create, read, update, archive and restore - no dead ends
- [ ] Validation, error, loading and empty states all designed and built
- [ ] **Survives the export/import round trip** - anything it adds to the store
      is in `storeSchema` and in the covering fixture that test runs over
- [ ] Unit + integration tests; at least one end-to-end path
- [ ] Accessibility pass: keyboard navigation and screen-reader labels
- [ ] Docs updated; an architecture decision recorded if one was made
- [ ] Zero TODOs, zero feature flags left enabled, zero commented-out code

Not every row applies to every change. A pure-logic addition has no migration
and no screens; ticking rows that do not apply is worse than deleting them,
because it teaches everyone to stop reading the list.

Every piece of work additionally answers:

1. **Which felt pain does this trace to?** No answer, no feature.
2. **Declared non-goals.** Where scope pressure gets absorbed: a good idea
   arriving mid-build becomes a new issue, not a bigger current one.

**The list below is an inventory, not a work breakdown.** The bullets under
each capability are the pieces it decomposes into, and they are not all
independently shippable - several usually have to land together before anything
is usable, and one occasionally spans two capabilities. Size the work by what
delivers a whole behaviour, not by what fits one bullet.

---

## 2. Build order

```
Foundation
  +-> Profile
    +-> Career record store
      +-> Points and phrasings            <- the differentiator
        +-> Tagging and search
          +-> Composition
            +-> Render and templates
              +-> Export
                +-> Versions and snapshots
                  +-> Import
                  +-> ATS linter
                  +-> Role profiles
                  +-> Portfolio site
```

The record store comes before points because points attach to records that
must already exist. Tagging comes after points so it is built once, across
records and points together, rather than twice. The ATS linter comes before
any future template builder.

---

## 3. Capabilities

### Foundation

The workspace and toolchain; the design system - semantic tokens over both
schemes, a glyph registry keyed by meaning, the primitives, and the three screen
shapes every screen is one of (`application-structure.md` #10); the Zod schema
package with versioning and JSON Schema emit; the database package with Drizzle, the PGlite and Postgres
drivers, the migration runner and the repository port; the domain package with
sort-key arithmetic, rich-text canonicalisation, content hashing and identifier
generation; the Hono API with validation, `problem+json` and a typed client;
the web app shell, its command palette and the landing page it shows without a
token; the `npx keepcv` local launcher and the three ways it decides who is
asking (`api-contract.md` #6); the JSON mirror and `keepcv restore`;
and the test harness.

**Native export and import, with the round-trip test, belong here** rather than
later. Once that test exists, everything built afterwards inherits a test proving
it did not break portability. It is a whole-store read and write rather than an
adapter, so it lives on the repository port and not in `@keepcv/interop`.

**What this needs is not a user system.** A store reached from a phone or a LAN
needs a credential that survives a restart, which the launch token is not; that
is `--auth password` and `--auth proxy`, and it is the whole of it. All three
modes answer the same single owner.

**Non-goals:** no accounts, no sign-up, no telemetry, no OIDC client.

### Profile

Built. Identity fields; contact channels with default visibility, written as
they are typed and ordered like any other list; a professional summary as a
phrasing set, so it gets variants, drafts and an append-only history for free.

The screen is the header of every resume this store compiles and the only place
it comes from. It names email and phone when neither is there, which is the
finding the linter would otherwise raise on the preview screen, after the resume
is built (application-structure.md #5.10).

### Career record store

Organisations. Experience, including multiple roles at one organisation.
Education, projects and their links, skills, certifications with expiry,
publications, awards, languages, volunteering, speaking, and custom sections.
Uniform links and fields on every record kind, and one presenter per record
kind.

Cross-cutting throughout: partial dates, archive and restore, drag-and-drop
ordering, and incompleteness nudges.

**Links, fields and custom sections are written from the app.** A link and a
field are sub-collections of a record that already exists, so they are added on
the record's own screen as they are typed rather than staged with the form
above them, exactly as a metric is on a point. `record_field_key_unique` covers
archived rows, so naming a removed field again puts that row back instead of
writing a second one - the same shape as placing something on a resume.

Custom sections have a screen of their own: create, rename, archive and put
back, with a count of what is filed under each. Until it existed the record
form's section picker had nothing in it and `custom_entry` was hidden, so a
whole record kind was unreachable.

Ordering is built, here and everywhere else a list is ordered. `useReorder` in
the web app is the one place a move is computed: it takes the scope the sort-key
index covers, archived rows included, answers the fractional key through
`keyForPosition` and writes one row. Dragging and the Up/Down buttons are the
same call, and a move that changes nothing writes nothing. Both, always - a list
that only drags is one a keyboard cannot order.

The record list splits custom entries by heading, because a custom entry's sort
key is scoped by the section it prints under and one list holding two headings
would be a list dragged across two scopes.

### Points and phrasings

The heart of the product. Point records with primary and secondary parents;
phrasing sets, variants and immutable revisions; **the authoring interface**;
a constrained inline markup editor; structured metrics; private evidence
(written on the point's own screen, and marked private where the rows are rather
than in help text - see application-structure.md #5.4);
confidence levels; revision history with compare and restore; and a usage view
answering "where is this used?".

Drafts belong here: keystrokes must not create revisions, and in-progress text
must survive a closed tab. The store keeps one draft per field of a target,
overwritable and outside history, and it travels with the boot payload so an
editor knows one is waiting before it opens (data-model.md #5).

### Tagging and search

A tag vocabulary with rename and merge; assignment across both records and
points; search over records and points, ranked and matching on prefixes so it
answers while the query is still being typed; filters persisted in the URL;
saved filters.

**Search is a pure function over the boot payload, not a table** (data-model.md
#8). It therefore has no migration, no route and no index to maintain, and the
same call serves the browser, the CLI and anything server-side.

The vocabulary is written from the app: a tag is created, renamed, archived, put
back and merged away on its own screen, and assigned from the record and point
screens by typing the word rather than picking an id. `tagForLabel(store, label)`
decides whether that is a new tag or the one already there, so two spellings of
one word cannot become two tags (application-structure.md #5.5). Both lists narrow
by tag, and the tag is in the URL.

Saved filters are built: the record list and the point list each keep named
narrowings above them, saved from whatever is on screen and offered back as a
way to that list. A row stores **what the narrowing means** rather than the
vocabulary of the control that produced it - `unplaced` and `unmeasured` are
facts about a point, and the archived scope is the same three values on both
lists - so a widget can be redrawn without rewriting the rows. One list is not
saved twice: a filter matching the narrowing on screen is named instead of the
save control being offered (data-model.md #8.1).

### Composition

Built. The resume entity and its target context; include and exclude toggles at
all three levels; phrasing selection per point; section, entry and point
reordering; section headings and visibility; per-resume contact visibility.

**A resume is read through `composition(store, resumeId)` in `@keepcv/core`,
not a route** (api-contract.md #3), for the reason search is a selector: every
row it resolves is already in the boot payload. The three collections it reads
are what a client writes through, and a write settles by merging the row it
answered with rather than re-reading the payload
(application-structure.md #4).

Adding and taking off are one control, because every uniqueness index on the
composition covers archived rows and placing is therefore a create or a put-back
(data-model.md #9.1).

A resume is created, renamed, archived and put back from the app as well, which
is what stopped the composer being reachable only by a resume somebody else had
made.

Deriving a resume from an existing one is built: `derivePlan(store, resumeId,
into)` in `@keepcv/core` answers every row a copy needs and
`POST /v1/resumes/{id}/derive` writes them in one transaction, applying the plan
through the methods a composition write already uses. The composition, the
template and every toggle come across; the posting does not
(application-structure.md #5.11). Dragging is built too, at all three levels.

Nothing is outstanding here.

### Render and templates

The `ResumeDocument` compiler is built as two steps in `@keepcv/core`:
`captureManifest(store, resumeId)` resolves the selection and freezes it, and
`renderManifest(manifest, revisions, options)` formats it. `compile()` is the
pair, one presenter per record kind, and `GET /v1/resumes/:id/document`. A live
preview and a version pinned months ago therefore render through one path.

The template contract is built too, in `@keepcv/templates`: a template declares
its settings as fields, ships its own stylesheet, and passes `isATemplate` over
the shared fixture, which is what "is a template" means
([`template-model.md`](template-model.md) #5). The preview mounts it in an
iframe of its own at the size it will print at.

**Templates are data, and the user can write one.** One renderer and one
stylesheet builder are driven by a `TemplateSpec` - values for a catalogue of
knobs, plus optional CSS of your own - and `fromSpec` turns a spec into a
`Template`. `ats-single-column` and `ats-left-heading` are two specs held in
code; anything else is a `template` row, edited on a screen of its own with a
live preview, offered to every resume beside the shipped two, and saved out as a
file another store reads back. The knobs are split so a resume adjusts only what
makes it fit - page size, typeface, sizes, margins - and the design itself
belongs to the template, which is what lets each one's compliance notes be
derived rather than claimed.

A resume pins the template it chose along with everything else it says, and a
template the user wrote is pinned **whole**: it is a row they can edit, so an
id alone would let a June edit rewrite what a March version claims was sent.

Length budgeting is built on top of that. The frame measures the column the
template just laid out and `paginate` in `@keepcv/core` fills pages from it,
honouring the break rules the stylesheet declares; the preview draws a labelled
rule where each page begins, and `lengthBudget` names what sits past the
`page_limit` the resume asked for. No pagination library is involved and the
arithmetic is a pure function with its own tests (application-structure.md #7).

Ranking what to drop is built on top of that again. A resume carries the posting
it is written against, and `targetMatch(store, resumeId)` in `@keepcv/core` reads
it: it ranks the terms the posting leans on, says which of them anything placed
answers, and scores every placed point against them so the weakest are named
first. It is a pure function over the boot payload, like `search` beside it, and
it is deliberately shallow - term frequency over a stopword list, prefix matching
bounded to an inflection, and a weighting for what the store already files work
under. There is no model and no service call; see
`application-structure.md` #8.

What remains is **further shipped designs**, which are now specs rather than code.

### Export

HTML and PDF are built, as `renderHtml(document)` in `@keepcv/render`: one
self-contained file carrying the template's own stylesheet, downloaded from the
preview screen or written by `keepcv render`. PDF is the same file handed to the
browser's printing engine, because the stylesheet already states `@page` and the
break rules - there is no PDF writer and no headless browser
(application-structure.md #7.1).

JSON Resume is built too, as `toJsonResume(document)` in `@keepcv/interop`,
with `lossOf(document)` beside it. The adapter reads a `ResumeDocument` rather
than the store, because that format describes a resume and not a career history,
and the loss report is counted **against this resume** - three metrics, two
sections with nowhere to go - rather than being a standing list of caveats
nobody reads. It is shown before the download, not after, and nothing with a
count of zero appears in it.

`keepcv render --format jsonresume` is the same pair from the terminal, for
piping into whatever else the user runs. There is no lint report on that
branch: nothing was rendered to read back, so the linter has no bytes to have
an opinion about, and the loss report is what belongs there instead.

There is no `?format=jsonresume` on `/v1/export`: the native export is a
whole-store read and belongs to the server, but a resume in somebody else's
format is a pure function of a document the caller is already holding.

Full-store backup and restore is built too, and it is the launcher's rather than
the API's. `keepcv serve` writes a readable copy of the whole store beside the
data directory as it starts, on a timer and as it stops; `keepcv backup` and
`keepcv restore` do the same on demand; and the app's own data screen downloads
one through `/v1/export` and reads one back through `/v1/import`. There is no
`/v1/backup/*`, because those routes would have handed `createApi` a filesystem
(application-structure.md #5.9).

`keepcv status` is the read-only half of the same job: what the store holds,
where the backup is and how old it is, which sign-in mode will work, and the
`unfinished` nudges `overview()` already answers. It is a caller for a selector
that runs in the browser and on disk alike, so nothing is derived twice.

**Every command answers an exit code and a sentence, never a stack trace.**
`run(argv)` in `apps/cli/src/cli.ts` is total: an unknown flag, a busy port, a
data directory nobody can write to and a file that is not a backup are all
things the user did, and a Node stack trace tells them nothing about any of
them. `index.ts` is a bin shim over it, which is also what makes the dispatch
testable at all.

What remains is **DOCX, LaTeX and Typst as things a resume leaves as**. Reading a
DOCX is built and writing one is not, which is the harder half: the reader takes
whatever a file happens to look like, and a writer has to decide what this
product's output looks like in a format with no page model of its own.

### Versions and snapshots

Built. `captureManifest(store, resumeId)` in `@keepcv/core` freezes what a resume
says, the store assigns the sequence and refuses a duplicate of the current
manifest, and `resume_content_ref` answers "where is this used?" for records and
points. `diffManifests(a, b, revisions)` compares any two, and a restore writes
the older selection back over the working composition and appends a version
saying where it came from. The resume screen's third view is the timeline, the
comparison and the restore.

Starring is there too: a snapshot is a version the user named, so it asks for a
label, and unstarring archives the row.

Exporting a version is built. `GET /v1/resume-versions/{id}/document` compiles a
version's manifest through `renderManifest`, resolving the revisions the manifest
pinned rather than what the phrasings say now, and the timeline hands that
document to the same download panel the working resume uses. A route rather than
a selector, for the reason the diff is one: the boot payload deliberately
carries only what each phrasing currently says. Sending an old version no longer
means restoring it first, which rewrote the working composition to send
something already sent.

### Import

Native import is in Foundation, because it is a whole-store read and write. This
is the other one: a file somebody else's tool wrote, merged into a store that
already holds things.

**An `Intake` is what a file said, before anything decides what to do about it.**
No ids, no ordering and no foreign keys - an organisation arrives as the name
that was printed and a custom entry as the heading it sat under. Its record
union is built from the same per-kind field map the stored union is, so a kind
that gains a field cannot gain it on one side only. Every reader answers this
one shape, and the reader says whether the file `declared` what each thing was
or whether it was `inferred` from how the file looked.

**Reading happens where the file is, and the file never leaves it.** A reader is
a pure function over bytes, so the browser reads the resume in the tab and the
CLI reads it on disk; what reaches the store is the reviewed intake. That keeps
file parsing off the API surface entirely, and a resume - which is personal data
- out of every request log between the tab and the store.

**The reconciliation interface is the point, not a wrapper around it.**
`matchIntake(store, intake)` answers what each incoming thing looks like it
already is, and `importPlan(store, intake, decisions)` answers the rows; both
are pure functions over the boot payload, for the reason `restorePlan` and
`derivePlan` are. `POST /v1/intake` re-plans server-side and applies in one
transaction, because a client-computed list of rows to write is a client
deciding what the store contains.

**A merge adds what the file had and leaves the record alone.** The record in
the store is what the user curated; a file exported months ago does not get to
backfill it. So every write in a plan is a create, no concurrency token is
involved, and applying one file twice writes nothing the second time - the
property the whole design rests on, tested at the plan and over the API.

**A PDF and a DOCX go through one segmenter, not two readers.** Both extractors
answer `DocumentLine[]` - text, emphasis, whether it was a list item, which
column and which page - and `fromLines` does all the reasoning over that. A DOCX
names its headings and its lists; a PDF has neither, so the extractor there
works them out from size, font and the leading glyph. That seam is the same one
pagination uses: the thing that knows about layout reports geometry, and the
pure function reasons about it.

Three failures shaped it and each has a test: the name at the top is set larger
than everything else and the size rule alone files the whole resume under it; a
DOCX that uses Heading1 for sections and Heading2 for job titles files every job
under itself unless the shallowest level present is taken as the section level;
and two headings set at one height in two columns are one row and two lines, so
joining them puts the right column's entries under the left column's heading.

**Which format a file is written in is not its extension.** The PDF and ZIP
magic bytes answer first, then the shape of the parsed object; a file called
`.json` can be any of three things, and a Reactive Resume export has `basics`
just as a JSON Resume one does, so the order those branches are tried in is
load-bearing and tested.

**A format that stores a period as the line it printed goes through one date
reader.** Reactive Resume holds `"March 2021 - Present"` where JSON Resume holds
two ISO dates, and RenderCV holds either two dates, a bare year as a number, or
an end date of `present`. The reader that already turns a printed period into a
partial date is the one a PDF needs, so nothing new was written for these two,
and a period no reader can read is named in `notes` rather than emptied quietly.

**What the entry says outranks the heading above it.** RenderCV names its
sections whatever the user liked and detects the entry type from which keys are
set, so an entry carrying a company is experience even under a heading reading
"Projects". Only the entry types that name nothing - a bare bullet, a one-line
label, a generic entry - fall back to the heading, and a heading that matches
nothing becomes a custom section rather than being forced into a near miss. The
heading match is the one guess in either reader, and the kind it produced is on
the row the reviewer approves.

**An item the file was not printing is exactly what an import must not skip.**
Reactive Resume marks trimmed content `hidden`, and a store that exists so a
resume can be a selection over it has somewhere to put that. Likewise a role
held at one company becomes a record of its own, which is what one organisation
over several titles is for; and a custom section's items are typed, so they are
filed as what they are and only the heading is reported lost.

JSON Resume is built both ways, with the round trip holding the two adapters
together. Reading RenderCV and Reactive Resume is built; writing them is not,
and neither is a second export format in general - `lossOf` counts what one
costs, and a format nobody asked to export is loss with no reader behind it.

**Non-goals:** no resume parsing service, no model call, and no scraping of any
profile anywhere. A reader misses rather than invents, and says in `notes` what
it could not place.

### ATS linter

Built, as `lint({ document, html })` in `@keepcv/ats-lint`. Seven rules over the
compiled document and the file the template wrote: contact details a reader can
extract, section headings a system is built to look for, dates that carry a year
and read one way, a history a reader can build a timeline out of, reading order
that survives being pulled off a printed page, text that is text rather than a
picture, words that are in the file and not on the page, and words put in the
page margin.

**Hidden text is a blocker and says why.** Whatever `display: none` was put there
for, a reader that compares the file with the page finds words nobody printed,
and that reads as stuffing rather than as a mistake - which is how a resume gets
binned rather than ranked. The rule names the construct so the user can find it
in a design they wrote. The preview screen shows the report
beside the download, and `keepcv render` prints it after writing the file.

The tier is derived from the findings and asserted nowhere, and the panel says
so: this product makes no claim of compatibility with any named commercial
system. A finding about the file names a construct the template chose, so the
linter is also how a user compares templates on something other than looks
(application-structure.md #7.2).

There is no `/v1/lint`: the caller holds the document and the file already, for
the same reason search and `composition` are selectors rather than routes.

What remains is more rules as real postings turn up cases these seven miss.

### Role profiles

Built. A `role_profile` is a name and a set of words from the tag vocabulary,
which is what a controlled vocabulary was for: rename and merge keep the rule
meaningful without a migration. Naming one, renaming it, ordering it, archiving
it and putting it back are a screen of its own, and a word is added by typing it,
so a label nobody has used yet becomes a tag and joins the rule in one motion -
the same one control the picker on a record is.

**One rule, stated once: something is selected if it carries one of the words,
and a record's words reach the points under it.** A record tagged "Backend" is a
job that was backend work, so all of it comes; a record that is not brings only
the points that are. `roleProfileMatch(store, roleProfileId)` in `@keepcv/core`
answers that over the boot payload, like `search` and `composition` beside it, so
the count on the profiles screen and the count in the resume's picker cannot
disagree.

**Applying one is additive, and that is the whole design.** It places what the
words select and takes nothing off, so a profile applied to a resume somebody
curated cannot undo the curation; every write is a create or a put-back, because
each uniqueness index on the composition covers archived rows; and applying one
twice writes nothing the second time. `roleProfilePlan` answers the writes and
`POST /v1/role-profiles/{id}/apply` re-plans server-side and applies them in one
transaction, for the reason an intake and a derive do.

**A plan is one shape, and one applier writes it.** `CompositionPlan` is what a
restore and a role profile both answer, so `applyCompositionPlan` in the API is
written once and the awkward part - unarchive, then patch, in dependency order -
has one implementation rather than two that drift.

**Non-goals:** no rule beyond the words - no "and not", no kind filter, no
scoring. A profile that needs a query language is a saved filter, and that is a
different table that already exists.

### Portfolio site

Built, and it is exactly what it says: a second renderer over `ResumeDocument`,
not a second product. `renderSite(document)` in `@keepcv/render` answers one
self-contained HTML file - system fonts, a light and a dark scheme, a jump list
between sections, one card per entry - downloaded from the preview screen or
written by `keepcv render --format site`. It sits beside `renderHtml` for the
reason that one is a function rather than a route: the caller already holds the
document.

**It is not a template.** A template is configured because a resume has to fit a
page, and every knob in the catalogue is about paper - size, margin, page
breaks, headings in a column. A page has no page to fit, so the site has one
stylesheet and no settings at all. What it does share is `prose.tsx`: escaping a
mark, keying an element and printing a field as `label: value` are obligations
every renderer over a document has, not just a print one, so those are exported
rather than written twice.

**What a stranger sees is decided in the composer, not here.** The page prints
the contact details the resume prints, and per-resume contact visibility already
exists; a second switch would be a second place to get it wrong. Evidence cannot
reach it for the reason it cannot reach a resume - `ResumeDocument` has no field
it could travel in - and the test asserts the page prints no element the resume
would not have. Tags are not printed either: no template prints them, and they
are the words the store files work under rather than words anybody chose to
publish.

**It is named `index.html`.** That is what every static host looks for, and it is
what keeps the page from overwriting the resume when both are written into one
directory.

**Non-goals:** no hosting, no deploy step, no domain, no analytics, no second
page. This produces a file; where it goes is the user's business.

---

## 4. Standing non-goals

Restated because they will be requested: no job application tracking, no job
boards, no interview preparation, no recruiter-facing products, no AI writing
features, no LinkedIn scraping, no mobile apps, and no claims of certification
against named commercial ATS products.
