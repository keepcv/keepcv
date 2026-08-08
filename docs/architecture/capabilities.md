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
- [ ] **Survives the export/import round-trip property test**
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

**Native export and import, with the round-trip property test, belong here**
rather than later. Once that test exists, everything built afterwards inherits
a test proving it did not break portability.

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
a constrained inline markup editor; structured metrics; private evidence;
confidence levels; revision history with compare and restore; and a usage view
answering "where is this used?".

### Tagging and search

A tag vocabulary with rename and merge; assignment across both records and
points; global full-text search; type-ahead trigram search; filters persisted
in the URL; saved filters.

### Composition

The resume entity and its target context; include and exclude toggles;
phrasing selection per point; section and entry reordering; section headings
and visibility; per-resume contact visibility; deriving a resume from an
existing one.

### Render and templates

The `ResumeDocument` compiler and the shared template fixture
([`template-model.md`](template-model.md)); the template contract and config
schemas; an ATS-strict single-column template; a Paged.js live preview in an
isolated iframe; typography and spacing configuration; further templates; and
length budgeting with overflow warnings and drop suggestions.

### Export

PDF and HTML. A JSON Resume adapter with explicit lossiness warnings. DOCX,
LaTeX and Typst. Full-store backup and restore.

### Versions and snapshots

Version capture on export and save; a timeline; a structural diff between any
two versions; restore as a forward operation; starred snapshots with labels
and target context; usage index maintenance.

### Import

Native import; JSON Resume import; PDF and DOCX parsing; RenderCV and Reactive
Resume adapters; and **the reconciliation interface** - every import is
reviewed before it is applied.

### ATS linter

A rule engine and report contract. Checks for column reading-order integrity,
non-standard section headings, text rendered as images, unparseable dates and
contact-detail extractability. Compliance tiers are derived from lint results,
never asserted.

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
