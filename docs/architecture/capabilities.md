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
                  +-> Accounts and sync
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

The workspace and toolchain; the Zod schema package with versioning and JSON
Schema emit; the database package with Drizzle, the PGlite and Postgres
drivers, the migration runner and the repository port; the domain package with
sort-key arithmetic, rich-text canonicalisation, content hashing and identifier
generation; the Hono API with validation, `problem+json` and a typed client;
the web app shell; the `npx keepcv` local launcher; the JSON mirror and
`keepcv restore`; and the test harness.

**Native export and import, with the round-trip test, belong here** rather than
later. Once that test exists, everything built afterwards inherits a test proving
it did not break portability. It is a whole-store read and write rather than an
adapter, so it lives on the repository port and not in `@keepcv/interop`.

**Non-goals:** no auth, no hosted deployment, no telemetry.

### Profile

Identity fields; contact channels with default visibility; a professional
summary with phrasing variants; private versus exportable flags.

### Career record store

Organisations. Experience, including multiple roles at one organisation.
Education, projects and their links, skills, certifications with expiry,
publications, awards, languages, volunteering, speaking, and custom sections.
Uniform links and fields on every record kind, and one presenter per record
kind.

Cross-cutting throughout: partial dates, archive and restore, drag-and-drop
ordering, and incompleteness nudges.

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

What remains is **saved filters**.

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

What remains is **deriving a resume from an existing one**, and dragging: the
order is changed by keyboard today, which is the accessible half and the half
the sort-key arithmetic actually needs.

### Render and templates

The `ResumeDocument` compiler is built as two steps in `@keepcv/core`:
`captureManifest(store, resumeId)` resolves the selection and freezes it, and
`renderManifest(manifest, revisions, options)` formats it. `compile()` is the
pair, one presenter per record kind, and `GET /v1/resumes/:id/document`. A live
preview and a version pinned months ago therefore render through one path.

The template contract is built too, in `@keepcv/templates`: a template declares
its settings as fields, ships its own stylesheet, and passes `isATemplate` over
the shared fixture, which is what "is a template" means
([`template-model.md`](template-model.md) #5). `ats-single-column` is the first
one, the resume screen picks it and tunes its typography and spacing, and the
preview mounts it in an iframe of its own at the size it will print at.

A resume pins the template it chose along with everything else it says, so a
template swapped later cannot change what an older version claims was sent.

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

What remains is **further templates**.

### Export

HTML and PDF are built, as `renderHtml(document)` in `@keepcv/render`: one
self-contained file carrying the template's own stylesheet, downloaded from the
preview screen or written by `keepcv render`. PDF is the same file handed to the
browser's printing engine, because the stylesheet already states `@page` and the
break rules - there is no PDF writer and no headless browser
(application-structure.md #7.1).

What remains is a JSON Resume adapter with explicit lossiness warnings; DOCX,
LaTeX and Typst; and full-store backup and restore.

### Versions and snapshots

Built. `captureManifest(store, resumeId)` in `@keepcv/core` freezes what a resume
says, the store assigns the sequence and refuses a duplicate of the current
manifest, and `resume_content_ref` answers "where is this used?" for records and
points. `diffManifests(a, b, revisions)` compares any two, and a restore writes
the older selection back over the working composition and appends a version
saying where it came from. The resume screen's third view is the timeline, the
comparison and the restore.

Starring is there too: a snapshot is a version the user named, so it asks for a
label, and unstarring archives the row. What remains is **exporting a version**:
`renderManifest` and `renderHtml` are both there, so it is a screen away.

### Import

Native import; JSON Resume import; PDF and DOCX parsing; RenderCV and Reactive
Resume adapters; and **the reconciliation interface** - every import is
reviewed before it is applied.

### ATS linter

Built, as `lint({ document, html })` in `@keepcv/ats-lint`. Five rules over the
compiled document and the file the template wrote: contact details a reader can
extract, section headings a system is built to look for, dates that carry a year
and read one way, reading order that survives being pulled off a printed page,
and text that is text rather than a picture. The preview screen shows the report
beside the download, and `keepcv render` prints it after writing the file.

The tier is derived from the findings and asserted nowhere, and the panel says
so: this product makes no claim of compatibility with any named commercial
system. A finding about the file names a construct the template chose, so the
linter is also how a user compares templates on something other than looks
(application-structure.md #7.2).

There is no `/v1/lint`: the caller holds the document and the file already, for
the same reason search and `composition` are selectors rather than routes.

What remains is more rules as real postings turn up cases these five miss.

### Accounts and sync

Better Auth integration; a server storage adapter; local-to-hosted migration;
account deletion with a mandatory export offer. Server-side entitlements live
in the private repository only.

### Role profiles

Tag-rule definition; applying a profile to pre-select a record set; profile
management.

### Portfolio site

A second renderer over `ResumeDocument`, not a second product.

---

## 4. Standing non-goals

Restated because they will be requested: no job application tracking, no job
boards, no interview preparation, no recruiter-facing products, no AI writing
features, no LinkedIn scraping, no mobile apps, and no claims of certification
against named commercial ATS products.
