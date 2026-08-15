# AGENTS.md

Guidance for coding agents (including Claude Code - claude.ai/code) working in
this repository.

## What this is

KeepCV is a career data store that compiles into resumes. The store holds
everything permanently; a resume is a *selection* over the store plus a template.
The founding problem: people keep career history inside their resume file, so
every trim to fit one page is an unrecoverable delete.

Most of what follows is **specified but not yet built** - see "Current state".

## Read the specs first

`docs/architecture/` is tracked and is the authoritative design. Read it before
changing anything it describes.

| File | What it is |
|---|---|
| `data-model.md` | Tables, invariants I1-I15, indexing plan |
| `template-model.md` | `ResumeDocument` - the uniform contract every renderer binds to |
| `application-structure.md` | Layering, state ownership, query keys, screen read models |
| `api-contract.md` | HTTP surface and the repository port |
| `capabilities.md` | What the product will contain, the build order, the Definition of Complete |

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

```sh
corepack enable && pnpm install    # Node 24+, pnpm via corepack

pnpm check          # everything CI runs
pnpm lint           # Biome: formatting + bulk linting
pnpm lint:fix       # Biome, applying fixes
pnpm lint:types     # ESLint: type-aware rules only
pnpm typecheck      # tsc across packages, including tests
pnpm test           # Vitest across packages
pnpm build          # tsc -b
pnpm changeset      # optional until the first publish; see CONTRIBUTING.md
```

Run the store and its API on this machine, against a throwaway data directory:

```sh
pnpm build && node apps/cli/dist/index.js serve --data-dir ./.keepcv-scratch
```

Single test file, or single test by name:

```sh
pnpm --filter @keepcv/core exec vitest run src/ordering/sort-key.test.ts
pnpm --filter @keepcv/core exec vitest run -t "produces the first key"
```

The published JSON Schema is generated and a test fails when the committed copy
has drifted. Re-emit it in the same commit as any schema change:

```sh
pnpm --filter @keepcv/schema schema:emit
```

Migrations are generated from the Drizzle schema and CI fails when the two
disagree. Regenerate in the same commit as any schema change, and read the SQL
before committing - a destructive step does not merge:

```sh
pnpm --filter @keepcv/db db:generate
```

The repository contract suite runs against PGlite by default. Point it at a
server PostgreSQL to run both, which is what CI does:

```sh
DATABASE_URL=postgres://... pnpm --filter @keepcv/db test
```

## Current state

`packages/schema`, `packages/core`, `packages/db` and `packages/api` exist, and
`apps/cli` is the `keepcv` launcher. `interop`, `templates`, `render`,
`ats-lint` and the web app are specified but deliberately **not scaffolded** -
empty packages are noise, and a sub-feature is either not started or complete.
Create each one when its capability is built, and add it to the root
`tsconfig.json` references then.

The database holds `owner`, `profile`, `contact_channel`, `organisation`,
`custom_section`, `record`, `record_link`, `record_field`, `phrasing_set`,
`phrasing`, `phrasing_revision`, `point`, `point_record_link`, `metric` and
`evidence`, and the port has seven repositories. That is the whole record store;
much of the data model describes tables that do not exist yet - drafts, tags,
search, resumes, versions; do not assume otherwise.

The API serves `/v1/store`, `/v1/profile`, `/v1/export`, `/v1/import`,
`/v1/openapi.json`, the point's secondary records and phrasing revisions, and
eleven owned collections: `/v1/contact-channels`, `/v1/organisations`,
`/v1/custom-sections`, `/v1/records`, `/v1/record-links`, `/v1/record-fields`,
`/v1/points`, `/v1/metrics`, `/v1/evidence`, `/v1/phrasing-sets` and
`/v1/phrasings`. That is the whole record store; tags, search, resumes and
versions are unbuilt, and there is no UI. `createApi` takes the port, an owner
scope and an `authenticate` function and knows nothing else - no driver, no token
store, no port number.

**`GET /v1/store` is the boot payload and `GET /v1/export` is the archive.** Both
answer the same `Store` shape; the first narrows `phrasingRevisions` to what each
phrasing currently says, because history grows without bound and is fetched on
every open. There is deliberately no summary route: counts, recent activity and
nudges are pure functions of that payload and belong in `@keepcv/core`, which
runs in the browser, rather than being derived a second time in SQL.

**Routes are declared with `createRoute` from `@hono/zod-openapi`**, using the
schemas from `@keepcv/schema` directly, so the OpenAPI document and the request
validator cannot describe different shapes. A route added any other way is
invisible to the document.

**An owned collection answers six routes, and their declarations come from
`collectionRoutes`** in `routes/collection.ts` - path, tag, noun and four
schemas in, six `createRoute` values out. Handlers stay in the resource's own
file: Hono derives a handler's types through conditionals on the schema type,
which TypeScript defers while the schema is a type parameter, so a builder that
mounted the handlers too would have to cast away the checking that declaring
routes this way exists to provide. Add a resource by calling it, not by copying
another resource's declarations.

Native export and import exist as `repositories.store`, and the round-trip test
in `contract-store.test.ts` runs over a store built to cover every collection the
format declares. **A slice that adds a table adds it to `storeSchema` and to that
fixture**, or it ships a format that silently drops the user's data.

## Architecture

### The layering

One concept has four legitimate shapes, and conflating them is how this codebase
would rot:

```
row (@keepcv/db) -> entity (@keepcv/core) -> DTO (@keepcv/schema) -> view model (apps/web)
```

Rows never leave `db`. Entities never cross the network. View models never travel
upward. DTOs are not view models - formatting belongs in the UI. An entity type
is written only where the domain shape actually differs from the wire shape;
otherwise the DTO is both.

The one deliberate exception is `ResumeDocument`, which crosses every layer
unchanged. Duplicating it per layer would guarantee the preview and the exported
file eventually disagree.

### Two boundaries that are enforced, not encouraged

- **`@keepcv/core` performs no I/O.** No filesystem, no network, no drivers, no
  Node built-ins. It runs unchanged in Node and the browser, which is what lets
  the resume preview compile client-side from cached data while the server
  compiles the same document for export. Enforced by the compiler, not by review
  - see the `"types": []` note under "Toolchain constraints".
- **`@keepcv/schema` depends on nothing but Zod.** It is the single source of
  truth for every shared shape: TypeScript types, API validation, form
  validation, the export format and the published JSON Schema all derive from it.

### Rich domain, uniform presentation

Storage stays typed and kind-specific (`certification.expires_on`,
`skill.proficiency` are real queryable facts). Uniformity lives in
`ResumeDocument`, produced by one **presenter per record kind** in `core`. Every
entry - job, degree, project, talk - exposes the same slots, so templates never
branch on record kind and adding a record kind touches no template.

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
- **Ordering uses fractional sort keys**, not integer positions, so a
  drag-and-drop move writes one row.

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

**The default is no comment.** Rationale belongs in the written record - the
specs, the product context, the ADRs - where it is versioned, indexed and
findable. A copy in a comment block is a second copy, and it is the one nobody
updates.

Write one only where a reader would otherwise be misled or reintroduce a bug: a
non-obvious invariant, a deliberate deviation, a subtle case the code cannot
express, a bug actually hit once. Name the concrete failure when there was one.

- **One line. Two if the case really needs it.** Longer means it is spec
  material: put it there and leave a pointer (`data-model.md #3.6`). Never cite
  an ADR number or `PRODUCT.md` - those files are not pushed, so the reference
  resolves for nobody but you.
- **Not on every export.** A file annotated throughout is a file where the one
  load-bearing comment is invisible. Most declarations need none.
- Do not restate the code. If a comment paraphrases the line under it, delete it
  and name things better instead.
- Do not write JSDoc for self-evident signatures. Types already say it.
- Do not leave section banners, `// eslint-disable` without a reason, or
  scaffolding comments describing what you are about to write.

When you touch a file, the same bar applies to the comments already in it: an
over-long or now-redundant one gets cut down, not preserved out of politeness.

## Toolchain constraints

Several of these look like bugs. They are not - do not "fix" them.

- **TypeScript is pinned to 6.x** in the `catalog:` in `pnpm-workspace.yaml`. TS 7
  builds this workspace fine, but typescript-eslint 8 refuses to load against it,
  which would silently drop the type-aware lint pass.
- **Biome owns formatting and most linting.** `eslint.config.js` is deliberately
  thin - type-aware rules only. If a rule does not need type information, it
  belongs in `biome.json` or nowhere.
- **`biome.json` takes no comments.** A `//` line does not fail loudly - Biome
  discards the whole config and falls back to its defaults, so the next
  `pnpm lint:fix` silently reformats the entire repository to tabs at 80 columns.
  This has happened once.
- **Tests are typechecked but not built.** Each package's `tsconfig.json` excludes
  `*.test.ts` (and `*.harness.ts` in `db`); a sibling `tsconfig.test.json`
  typechecks them with `noEmit`. Including tests in the build puts compiled copies
  in `dist`, and Vitest then runs every suite twice.
- **`packages/core/tsconfig.json` sets `"types": []` on purpose.** With no ambient
  type packages and no DOM library, `node:fs` does not resolve and `process` is
  not declared, so the no-I/O boundary fails the build instead of failing review.
  The resulting error suggests installing `@types/node` - that is the wrong fix;
  move the I/O to `@keepcv/db` or `@keepcv/api`. Web Crypto's `getRandomValues` is
  `declare`d locally in `identity/uuid.ts` for the same reason.
- **Dependency versions live in the `catalog:`**, one per dependency repo-wide.
  Add versions there and reference `"catalog:"` in package manifests.
- **PostgreSQL is the only dialect**, local and hosted. Local uses PGlite (real
  Postgres in WASM, no Docker). Do not introduce SQLite.
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
- **`drizzle-kit` does not manage triggers.** The one the model needs -
  `phrasing_revision` refusing an update - is hand-written at the end of the
  migration that creates the table. A trigger is invisible to the snapshot, so
  `db:generate` stays clean; it is also invisible in the Drizzle schema, so the
  table that has one says so in a comment.

## How work is organised

Work lands **complete**: either it delivers behaviour someone can use end to end,
or it does not merge. There is no half-built state on `main`. The Definition of
Complete is in `capabilities.md` and mirrored in the PR template; rows that do
not apply are deleted, not left unticked.

`capabilities.md` is an inventory, not a work breakdown. Size a change by what
makes a whole behaviour - often several of its bullets together, occasionally
part of one. **Do not number features.** A numbering scheme reads as a plan with
fixed boundaries, and the boundaries move as soon as you start building; name the
work instead.

Every feature answers: *which felt pain does this trace to?* and *what are the
declared non-goals?* The second is where scope pressure gets absorbed - a good
idea arriving mid-build becomes a new issue, not a bigger current one.

`main` is the default branch; branch before committing.

### Verify by trying to break it

`pnpm check` proves the code compiles and the tests pass. It does not prove the
tests would have caught anything.

- **Break the thing a test guards, and watch it fail.** Remove the owner
  predicate, the concurrency predicate, the kind check; run the suite; confirm
  the *right* tests fail; restore. This has already found a real gap: records,
  links and fields reached a fully green suite with no stale-write coverage at
  all, and only breaking the predicate showed it.
- **Assert the reason, not just the failure.** `rejects.toThrow()` on a
  constraint test also passes when the insert fails for a typo. Name the
  constraint (`error.cause.constraint`) or the error class.
- **De-risk a tool-dependent step before building on it.** If drizzle-kit might
  not round-trip a custom column type, generate twice and confirm the second run
  reports no changes - before writing the repository that depends on it.
- **Check the counts, not the colour.** A CI run reporting the same test count as
  a local one means the second driver never ran.

### Commits and pull requests stand alone

A commit message and a PR description are read by someone who has only that one
thing in front of them: a `git log` line months later, a reviewer opening a diff
cold, a bisect landing mid-history.

- **Keep them short.** A subject line and two or three short paragraphs: what
  changed, why, and anything a reviewer would otherwise reconstruct from the
  diff. No walkthrough of how the work went, no restatement of the diff, no
  alternatives-considered section. A long description does not get read, which
  makes the one load-bearing sentence in it invisible.
- **No cross-references to other commits or PRs.** Not "as in the previous PR",
  not "completes what #12 started". If context from elsewhere matters, restate it
  in a sentence. A reader following a link has already lost the thread, and the
  link rots the moment history is rewritten or a branch is squashed.
- **No ADR numbers and no `PRODUCT.md`.** Both are gitignored, so the citation
  resolves for nobody reading on GitHub. Give the conclusion and its reason in a
  sentence; the full argument belongs in the ADR and in `docs/architecture/`.
- **Describe this change and why, not the sequence it sits in.** Name what it
  delivers in words - "content hashing", "the phrasing editor". Do not invent or
  cite numbered feature identifiers; they imply an ordering that does not survive
  contact with how the work actually splits.
- **ASCII only**, as everywhere else.
