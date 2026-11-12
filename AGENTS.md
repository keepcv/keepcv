# AGENTS.md

Guidance for coding agents (including Claude Code - claude.ai/code) working in
this repository.

## What this is

KeepCV is a career data store that compiles into resumes. The store holds
everything permanently; a resume is a *selection* over the store plus a template.
The founding problem: people keep career history inside their resume file, so
every trim to fit one page is an unrecoverable delete.

## Read the specs first

`docs/architecture/` is tracked and is the authoritative design. Read it before
changing anything it describes.

| File | What it is |
|---|---|
| `data-model.md` | Tables, invariants I1-I18, indexing plan |
| `template-model.md` | `ResumeDocument` - the uniform contract every renderer binds to |
| `application-structure.md` | Layering, state ownership, query keys, screen read models |
| `api-contract.md` | HTTP surface and the repository port |
| `capabilities.md` | What the product contains, the build order, the Definition of Complete |

`docs/PRODUCT.md` and `docs/adr/` are **gitignored on purpose** and exist on disk
only: the product context, and every architectural decision with its rejected
alternatives. Read them; never commit them; never cite them anywhere that gets
pushed. Read the ADR before re-opening a decision, and write one when you make a
new decision. ADRs are append-only - a wrong one is superseded by a new record,
never edited in place.

### When a spec is wrong

It sometimes is, and building against it is what reveals that. Raise it before
the migration is written, not after. Signals worth stopping for:

- **It needs a guard test to hold itself together.** A fact stored twice and kept
  in step by hand, with a rebuild-and-compare test to catch the drift, is a
  design asking to be simplified.
- **It contradicts itself.** One section declaring a field vocabulary identical
  across kinds; another repeating that vocabulary per table.
- **It breaks an invariant below.** A table sketched without `owner_id`.
- **A rejected alternative was never the real alternative.** "One wide `jsonb`
  blob" losing is not an argument against a wide *typed* table.

Then:

- **Prefer the correction that removes something** - fewer tables, fewer copies
  of a fact, fewer constraints maintained by hand.
- **Edit the spec in the same change as the code**, so the two never disagree,
  and add an ADR carrying the argument.
- **Put it in the PR body, in plain words.** A deviation from a tracked spec is
  the headline, not a footnote; the reviewer is reading the diff against the spec
  they remember.
- **Where the spec is silent, decide, and write the decision into the spec.** A
  choice recorded only in code is a choice the next reader re-litigates.

The same applies to this file. If an instruction here is wrong, or two of its
rules conflict on the case in front of you, say so and propose the fix rather
than silently picking one.

## Commands

Use [Contributing](CONTRIBUTING.md#getting-set-up) for setup, commands, local
launch, targeted tests and generated-artifact checks. Run `pnpm check` for the
required repository checks. Changes outside tests need a changeset, or a
deliberate empty one, as described there.

## Current state

Everything the specs name is built. Create a new package only when its capability
is built, and add it to the root `tsconfig.json` references then - an empty
package is noise, and a sub-feature is either not started or complete.

**What exists.** `packages/schema`, `core`, `db`, `api`, `templates`, `render`,
`ats-lint`, `interop`, `agent` and `editor`; `apps/cli` is the `keepcv` launcher with `serve`,
`setup`, `render`, `status`, `backup`, `restore` and `set-password`; `apps/web` is the
browser app. `apps/web` is the one workspace project **not** in the
`tsconfig.json` references: it emits no declarations for anything to reference,
so it is a `noEmit` project that Vite builds and `tsc` only checks.

**The database holds 33 tables** - the record store, its vocabulary, its editor
state, the composition a resume is, and its history - and the port has fifteen
repositories. `resume_version` and `phrasing_revision` are append-only, each held
that way by its own hand-written trigger. There is no `search_document` and there
will not be one.

**The API** exposes the resource and timeline routes listed in
[API Contract](docs/architecture/api-contract.md#3-resources). `createApi`
receives its repository port, owner scope and authentication at the caller
boundary; it owns no driver, token store or port number.

**The editor** is published as `@keepcv/editor`, with an `Editor` entry taking
the typed API client, QueryClient and optional sign-out callback. It ships
compiled styles, the theme script and the DOCX worker. `apps/web` keeps launcher
authentication and mounts that same entry. Release validation installs an
isolated editor consumer from tarballs outside the workspace.

It is an application frame - a collapsible navigation rail grouped
into Store, Vocabulary, Resumes and System, a command palette on its header, and
a sheet in place of the rail below `lg` - over the assistant home, the store overview at /overview, the profile,
the record list, a record's detail and its form, the point list, the tag
vocabulary, the custom-section headings, the role profiles, the template library and
its visual builder, the resume list, a resume's composition, its Design view
and its history, the backup screen, and search results. All of it is fed by one
`GET /v1/store` on the root route's loader, and the preview is `compile()`
running in the browser over that same payload. React, TanStack Router and Query,
Tailwind v4, Vite, lucide for glyphs, and `components/ui/` for the primitives a
screen needs. Routes are declared in code rather than generated from filenames.

### The rules, and where each one is argued

These are the ones an agent breaks by not knowing them. The reason each is
right - and every rejected alternative - is in the spec section named beside it;
do not restate that argument here, in code, or in a commit message.

| Rule | Argued in |
|---|---|
| Screens read the cached store through selectors in `@keepcv/core`, never a request of their own. Counting, filtering, tag usage, every nudge, `composition(store, resumeId)` and `search(store, query)` are pure functions there. Formatting is the opposite and lives in the web app's `model/` | `application-structure.md` #1, #2 |
| `renderHtml`, `renderSite`, `lint`, `toBlocks` and the `interop` writers are functions, not routes: the caller holds every input | `api-contract.md` #3 |
| `GET /v1/store` is current state; `GET /v1/export` is the archive. Drafts are in both; revision history and manifests only in the second | `api-contract.md` #3 |
| Writes go through `useStoreMutation`, which patches the cache, rolls back on refusal and re-reads on settle; a composition write passes `settle` and merges the row instead | `application-structure.md` #4 |
| Adding and taking off are one control: every uniqueness index on the composition covers archived rows, so placing is a create or a put-back | `application-structure.md` #5.6 |
| Sub-collections write independently of parent forms; explicit Evidence and contact controls retain recovery until acknowledgment or discard | `application-structure.md` #5.3, #5.10 |
| Evidence is private structurally: `ResumeDocument` has no field it could travel in | `template-model.md` #1 |
| Every ordered list drags **and** keys, through `useReorder`; sort keys compare by code unit, never by locale | `capabilities.md` #3, `data-model.md` #3.5 |
| Text is never submitted: an 800ms debounce writes a `draft`, blur or thirty seconds idle appends a `phrasing_revision`. A draft found on open is offered, never restored | `application-structure.md` #6 |
| `captureManifest` freezes a resume and `renderManifest` turns it into the document, so there is no second compiler. A restore puts back the selection, not the words, and never rewinds | `template-model.md` #7, `data-model.md` #9.2 |
| Default templates use `fromSpec` and the FIT/DESIGN knobs; typed definitions install validators/renderers at the caller boundary, and HTML uses the bounded binding language | `template-model.md` #5 |
| Default ATS layouts use grids; creative HTML may use other layout constructs and receives advisory readability findings separately from technical safety | `template-model.md` #5 |
| The browser lays the page out and `@keepcv/core` counts it: `FlowBlock` geometry in, `paginate` and `lengthBudget` out. There is deliberately no pagination library | `template-model.md` #4 |
| `lint({ document, html })` takes the rendered bytes rather than producing them, so the thing linted is the thing sent | `capabilities.md` #3 |
| `lossOf(document, target)` is counted against this resume, and anything at zero is not in the list | `capabilities.md` #3 |
| The launcher serves app and API on one origin; the launch token travels in the URL fragment. `--auth token`, `--auth password` and `--auth proxy` all answer one owner, and binding off loopback refuses `token` | `api-contract.md` #6 |
| Screens name semantic tokens, never palette colours; three screen shapes; a pane's own layout is a container query | `application-structure.md` #10 |
| `danger` is for losing something, and archiving is not that | `application-structure.md` #10 |

### What is written down only here

Hard-won details with no home in the specs. Each one has cost a debugging
session already.

**Declaring routes.**

- Routes are declared with `createRoute` from `@hono/zod-openapi` using the
  schemas from `@keepcv/schema` directly, so the OpenAPI document and the request
  validator cannot describe different shapes. A route added any other way is
  invisible to the document.
- **A helper that builds routes takes the path as `<Path extends string>`, never
  `string`**: a widened path collapses the whole typed client into one
  `ClientRequest<string, string, ...>`, and the failure surfaces in the web app
  as "property does not exist" on an unrelated route.
- An owned collection's six declarations come from `collectionRoutes` in
  `routes/collection.ts`. Handlers stay in the resource's own file: Hono derives
  a handler's types through conditionals on the schema type, which TypeScript
  defers while the schema is a type parameter, so a builder that mounted the
  handlers too would have to cast away the checking that declaring routes this
  way exists to provide. Add a resource by calling it, not by copying another
  resource's declarations.

**Export and import.**

- Native export and import are `repositories.store`, and the round-trip test in
  `contract-store.test.ts` runs over a store built to cover every collection the
  format declares. **A slice that adds a table adds it to `storeSchema` and to
  that fixture**, or it ships a format that silently drops the user's data.
- History goes in `archiveSchema` - `storeSchema` extended with versions and
  snapshots - because the boot payload must not carry it; `read()` answers the
  archive and `readCurrent()` the store. `resume_content_ref` is in neither: it
  is derived from the manifests and rebuilt on import.

**Reading somebody else's file.**

- An `Intake`'s record union is built from the same `RECORD_EXTRAS` map the
  stored union is, and a test fails when a kind declares a field on one side
  only.
- `fromJsonResume`, `fromReactiveResume` and `fromRenderCv` all answer `Intake`,
  and the helpers three readers share are in `reading.ts` rather than copied per
  format - `readHtml` splits a Reactive Resume description into the summary and
  the points, and `readPeriod`, written for PDFs, reads `"March 2021 - Present"`
  there too.
- Magic bytes answer first, then the shape of the parsed object. A Reactive
  Resume export carries `basics` exactly as a JSON Resume one does, so that
  branch is tried first and a test fails if the order is swapped.
- `pdfjs-dist`, `fflate` and `yaml` are the only parsers, all three are behind
  `@keepcv/interop/files`, and none runs server-side.

**Writing somebody else's file.**

- The Word document is written the way `docxLines` reads one - `Heading1`,
  `Heading2`, `numPr` - which is what makes the round trip the only end-to-end
  check available on a format with no compiler to hand. Those style choices are
  not interchangeable with equally pretty ones. The zip is stamped with a fixed
  date, or two files built from one document would differ.
- A `.tex` and a `.typ` have to build on a machine with nothing installed, and
  neither is compiled by anything in this tree. `//` in a Typst address opens a
  comment and swallows the closing brackets after it, so a run carrying markup is
  quoted whole rather than escaped character by character.
- PDF is `renderHtml`'s file in a hidden iframe handed to `print()`. No headless
  browser and no PDF library: either would be a second layout engine to keep in
  step with the first. Where the printer and `paginate` disagree the printer is
  right, which is why the length budget warns rather than gates.

**The web app.**

- The dragged row is in React state rather than `dataTransfer`, which jsdom
  implements not at all. `useReorder` lives in `lib/order.ts` and takes the scope
  the sort-key index covers, archived rows **included**.
- `useStoreMutation` lives in `lib/store-cache.ts`.
- `record_field_key_unique` covers archived rows, so `buildField` answers a
  put-back rather than a create when a removed field is named again.
- Declare the whole "you are here" marker in the rail's active class: the router
  appends `activeProps.className` rather than merging it, and a base
  `before:bg-transparent` won.
- TypeScript does not excess-check a hyphenated JSX attribute, so
  `aria-expanded` on a component that does not forward it type-checks and is
  silently dropped. `Button` takes `expanded`.
- Dark mode is set by a blocking local script before first paint - an
  effect flashes a white page on the way into a dark one - and the choice lives
  on the shell, since two toggles with two hooks disagree.
- A custom section is a screen of its own, because until one exists the record
  form's section picker is empty and `custom_entry` is hidden, which made a whole
  record kind unreachable.

**The launcher.**

- `run(argv)` in `cli.ts` is total and `index.ts` is a bin shim over it, which is
  what makes the dispatch testable. Every command answers an exit code and a
  sentence, never a stack trace.
- **The launcher serves the web app out of its own `dist/web`**, copied there by
  `scripts/copy-web.mjs` at build time. `@keepcv/web` is private and is a
  devDependency for that reason: resolving the assets through it at runtime
  published a launcher whose interface was not on disk. `webAssetsDir()` names
  one path that is right from `src` and from `dist` alike.
- `openStore` is the one place a store is opened, so a half-opened PGlite is
  closed on the way out rather than left holding the directory.
- `keepcv status` reads `overview()` - the same selector the app's store overview
  reads - so the nudges are not derived a second time for the terminal.

## Architecture

Read [Application Structure](docs/architecture/application-structure.md#1-the-four-representations)
for rows, entities, DTOs, view models and their package boundaries.
`@keepcv/core` performs no I/O; `@keepcv/schema` depends only on Zod.
`ResumeDocument` crosses layers unchanged; kind-specific presenters in core
produce its uniform slots. The [template model](docs/architecture/template-model.md)
owns that contract and the compilation pipeline.

## Invariants that must not be violated

These are the point of the product, not preferences.

- **Nothing the user wrote is destroyed.** Soft-delete (`archived_at`), never
  `DELETE`. Genuine erasure is a separate, explicitly confirmed `purge`.
- **Phrasing text is append-only.** "Editing" appends a `phrasing_revision` and
  moves a pointer. Resume versions pin `phrasing_revision_id`, never
  `phrasing_id` - otherwise editing wording in June silently rewrites what a
  March snapshot claims you sent.
- **Migrations are expand/contract.** Add -> backfill -> switch -> drop in a
  *later* release. Never destructive in one step.
- **Export is never gated** by any account, licence or entitlement state.
- **Private evidence is excluded structurally**, not by a runtime filter -
  `ResumeDocument` has no field that could hold it. But it *is* included in the
  native export, because `import(export(store)) == store` is a tested property.
- **Every table carries `owner_id` from the first migration**, and repositories
  take the owner from ambient request scope, never a caller parameter.
- **This repository describes only what it contains.** Nothing pushed - docs,
  code, comments, `package.json` descriptions, CI, commit messages, PR bodies -
  refers to another repository, another deployment of this product, a tier, a
  price or an implementation that is not in this tree. "Self-hosted" is fine: it
  describes the person running it. A reader should never be able to infer that
  something exists beyond what they can see.
- **Ordering uses fractional sort keys**, not integer positions, so a
  drag-and-drop move writes one row.
- **A feature is usable without editing the file that implements it.** These are
  libraries, and a consumer that has to fork one has stopped being a consumer.
  Three shapes do this and all three are already here: injected at the boundary
  (`createApi`'s `authenticate`), declared by the implementation and rendered by
  the caller (a template's `fields`), or composed around rather than inside (the
  launcher's `/auth` routes, its backup mirror). If using what you built would
  mean changing a constant, widening a union or re-exporting a module, the seam
  is in the wrong place, and moving it costs less now than after a fork exists.
- **No package knows what a plan, quota, tier or entitlement is.** That is what
  keeps "export is never gated" true by construction rather than by review.

## Terminology (used consistently in code, API and UI copy)

- **Point** - the atomic content unit. Never "achievement", "bullet" or
  "highlight".
- **Version** - automatic resume history. **Snapshot** - a version the user
  starred. **Revision** - belongs to phrasings only. These three are distinct and
  must not be used interchangeably.

## Code style

**Write the shortest clear version of the thing.** Not the cleverest and not the
most general - the most direct. Every line is a line someone reads after a
three-month gap.

### ASCII only

Everything written here - code, comments, Markdown, commit messages, PR
descriptions - uses only characters reachable from a keyboard. No em or en
dashes, no typographic quotes, no arrows, no box-drawing characters, no section
signs.

Use `-` for a dash, `...` for an ellipsis, `->` and `<-` for arrows, `-`, `|` and
`+` for diagrams, and `#3.6` to point at a numbered section
(`data-model.md #3.6`). Prefer `;` as a list separator in prose.

The reason is editing friction: a character nobody can type is one nobody fixes a
typo next to, and it arrives differently depending on the editor or paste buffer
that produced it. Non-ASCII a test genuinely needs is written as an escape
(`"caf\u00e9"`), so the source stays ASCII.

### Keep it minimal

- **Solve the problem in front of you.** No speculative parameters, no "we might
  need this later" hooks, no abstraction with a single implementation. A second
  caller justifies an abstraction; anticipating one does not.
- **Take the direct route.** If a plain function, an early return or a language
  built-in does the job, use it. Indirection has to earn itself - a layer nobody
  needs is a layer everybody reads. Do not add a wrapper, a registry, a factory
  or an options object to avoid writing the obvious thing.
- **One way to do each thing.** Two helpers that overlap will drift, and the next
  reader has to work out which is current. Extend the existing one.
- **Delete rather than accumulate.** Dead branches, unused exports, leftover
  helpers from a refactor, commented-out code. Git remembers; the file should
  not.
- **Name things so the code reads as a sentence.** A well-named helper beats a
  comment explaining a badly-named one, and costs nothing at runtime.
- **Let the types carry the weight.** Make illegal states unrepresentable rather
  than validating them at every call site. Brand identifiers, narrow unions, no
  `any`.

Short is a consequence of being direct, not a target. Do not compress by removing
names, collapsing branches into ternaries, or golfing.

### Comment only when a comment is load-bearing

Default to no comment. Keep one only if removing it would cause the next reader
to introduce a bug. It must name a constraint, an actual past failure, or a case
the types cannot express. Explain what breaks; design rationale belongs in the
architecture specs. "X rather than Y, so that Z" earns its place only when Z
names an actionable failure or constraint, not a preference.

- Do not restate code, self-evident signatures or the design argument.
- No file paths, section numbers, ADR numbers or bare pointers in code comments.
- No section banners, scaffolding comments or unexplained `eslint-disable`.
- Use one line; two only when necessary. Wrap comment blocks at 80 columns;
  Biome's 100-column setting does not reflow them.
- A test comment names the failure it guards in one line; the test name says
  what it does.
- Apply this bar to existing comments in every file you touch. Rename unclear
  code before adding an explanation.

## Toolchain constraints

Several of these look like bugs. They are not - do not "fix" them.

- **TypeScript is pinned to 6.x** in the `catalog:` in `pnpm-workspace.yaml`. TS 7
  builds this workspace fine, but typescript-eslint 8 refuses to load against it,
  which would silently drop the type-aware lint pass.
- **Biome owns formatting and most linting.** `eslint.config.js` is deliberately
  thin - type-aware rules only. If a rule does not need type information, it
  belongs in `biome.json` or nowhere.
- **`complexity/useLiteralKeys` is off.** `noPropertyAccessFromIndexSignature` is
  on in `tsconfig.base.json`, so `errors["url"]` is what TypeScript requires
  whenever the property comes from an index signature, and the rule's fix is
  `TS4111` every time. It sat at 32 permanent infos before it was turned off.
- **`lint:types` runs eslint through `node --max-old-space-size=8192`.** The
  type-aware pass holds a `Program` per project and had been peaking just under
  Node's 4GB default; the next additive change of any size ran it out of memory,
  and the failure reads as `Ineffective mark-compacts near heap limit` rather
  than as a lint error. Every package still passes when linted on its own - the
  total is what fails. It is spelled as a `node` invocation rather than a
  `NODE_OPTIONS=` prefix because that prefix is not a command on Windows.
- **`biome.json` takes no comments.** A `//` line does not fail loudly - Biome
  discards the whole config and falls back to its defaults, so the next
  `pnpm lint:fix` silently reformats the entire repository to tabs at 80 columns.
  This has happened once.
- **Tests are typechecked but not built.** Each package's `tsconfig.json` excludes
  `*.test.ts` and `*.harness.ts`; a sibling `tsconfig.test.json` typechecks them
  with `noEmit`. Including tests in the build puts compiled copies in `dist`, and
  Vitest then runs every suite twice. A fixture shared by two test files is a
  `*.harness.ts`, never a `*.test.ts` another one imports - importing a test file
  registers its suites a second time.
- **`packages/core/tsconfig.json` sets `"types": []` on purpose.** With no ambient
  type packages and no DOM library, `node:fs` does not resolve and `process` is
  not declared, so the no-I/O boundary fails the build instead of failing review.
  The resulting error suggests installing `@types/node` - that is the wrong fix;
  move the I/O to `@keepcv/db` or `@keepcv/api`. Web Crypto's `getRandomValues` is
  `declare`d locally in `identity/uuid.ts` for the same reason.
- **Dependency versions live in catalogs.** Package manifests use the default
  `catalog:`. A named catalog can retain a patched transitive legacy major when
  an upstream still requires it; overrides reference that catalog too.
- **PostgreSQL is the only dialect**, on a laptop and on a server. Local uses
  PGlite (real Postgres in WASM, no Docker). Do not introduce SQLite.
- **Timestamp columns are `precision: 3`, not the Postgres default.** `updated_at`
  is the optimistic-concurrency token: it goes to the client as an ISO string and
  comes back to be compared against the column. A JavaScript `Date` holds
  milliseconds, so at microsecond precision that comparison never matches and
  every second write looks like a conflict.
- **`drizzle-kit` loads the schema through a CJS require**, so files under
  `packages/db/src/schema/` cannot import `@keepcv/schema` - the migration
  generator fails to resolve it. Where a vocabulary has to appear on both sides,
  write it out and add a test that feeds both the same values.
- **Tables in a foreign-key cycle share one file and annotate their extras
  callback** `(table): PgTableExtraConfigValue[] => [...]`. Without the
  annotation TypeScript infers each table's type through the callback that names
  the next one and fails with TS7022. `drizzle-kit` itself handles the cycle
  fine, emitting the constraints as `ALTER TABLE` after every `CREATE TABLE`.
- **`drizzle-kit` does not manage triggers.** The ones the model needs -
  `phrasing_revision` and `resume_version` refusing an update - are hand-written
  at the end of the migration that creates the table. A trigger is invisible to
  the snapshot, so `db:generate` stays clean; it is also invisible in the Drizzle
  schema, so the table that has one says so in a comment.

## How work is organised

Follow [Contributing](CONTRIBUTING.md#features-ship-complete) for complete feature
scope, verification, commits, pull requests and releases. The
[Definition of Complete](docs/architecture/capabilities.md#1-definition-of-complete)
is mirrored in the PR template; delete checklist rows that do not apply.
