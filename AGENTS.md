# AGENTS.md

This file provides guidance to coding agents (including Claude Code -
claude.ai/code) when working with code in this repository.

## What this is

KeepCV is a career data store that compiles into resumes. The store holds
everything permanently; a resume is a *selection* over the store plus a
template. The founding problem is that people keep career history inside their
resume file, so every trim to fit one page is an unrecoverable delete.

The project is in early development. Most of what is described below is
**specified but not yet built** - see "Current state".

## Read the specs first

`docs/architecture/` is tracked and is the authoritative design. Read it before
changing anything it describes.

| Path | What it is |
|---|---|
| `docs/architecture/data-model.md` | Tables, invariants I1-I14, indexing plan |
| `docs/architecture/template-model.md` | `ResumeDocument` - the uniform contract every renderer binds to |
| `docs/architecture/application-structure.md` | Layering, state ownership, query keys, screen read models |
| `docs/architecture/api-contract.md` | HTTP surface and the repository port |
| `docs/architecture/capabilities.md` | Capability tree F0-F13 and the Definition of Complete |

`docs/PRODUCT.md` and `docs/adr/` are **gitignored on purpose** and are present
on disk only. They hold the product context and the 20 architecture decision
records - every decision with its rejected alternatives. Read them; never commit
them, and never cite them anywhere that gets pushed. When a decision feels
re-openable, read the ADR before re-opening it. When you make a new
architectural decision, add an ADR.

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

Single test file, or single test by name:

```sh
pnpm --filter @keepcv/core exec vitest run src/ordering/sort-key.test.ts
pnpm --filter @keepcv/core exec vitest run -t "produces the first key"
```

The published JSON Schema is generated, and a test fails when the committed
copy has drifted. Re-emit it in the same commit as any schema change:

```sh
pnpm --filter @keepcv/schema schema:emit
```

## Current state

Only `packages/schema` and `packages/core` exist. `db`, `api`, `interop`,
`templates`, `render`, `ats-lint` and `apps/` are specified but deliberately
**not scaffolded** - empty packages are noise, and a sub-feature is either not
started or complete. Create each one when its capability is built, and add it
to the root `tsconfig.json` references then.

No database, no API, no UI yet. The data model in `docs/architecture/`
describes tables that do not exist. Do not assume otherwise.

## Architecture

### The layering

One concept has four legitimate shapes, and conflating them is how this
codebase would rot:

```
row (@keepcv/db) -> entity (@keepcv/core) -> DTO (@keepcv/schema) -> view model (apps/web)
```

Rows never leave `db`. Entities never cross the network. View models never
travel upward. DTOs are not view models - formatting belongs in the UI.

The one deliberate exception is `ResumeDocument`, which crosses every layer
unchanged. Duplicating it per layer would guarantee the preview and the
exported file eventually disagree.

### Two boundaries that are enforced, not encouraged

- **`@keepcv/core` performs no I/O.** No filesystem, no network, no drivers, no
  Node built-ins. It runs unchanged in Node and the browser, which is what lets
  the resume preview compile client-side from cached data while the server
  compiles the same document for export. Do not import a driver here. This is
  enforced by the compiler, not by review - see the `"types": []` note under
  "Toolchain constraints".
- **`@keepcv/schema` depends on nothing but Zod.** It is the single source of
  truth for every shared shape; TypeScript types, API validation, form
  validation, the export format and the published JSON Schema all derive from
  it.

### Rich domain, uniform presentation

Storage stays typed and kind-specific (`certification.expires_on`,
`skill.proficiency` are real queryable facts). Uniformity lives in
`ResumeDocument`, produced by one **presenter per record kind** in `core`.
Every entry - job, degree, project, talk - exposes the same slots, so templates
never branch on record kind and adding a record kind touches no template.

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
  starred. **Revision** - belongs to phrasings only. These three are distinct
  and must not be used interchangeably.

## Code style

**Write the shortest clear version of the thing.** Not the cleverest and not
the most general - the most direct. Every line is a line someone has to read
after a three-month gap.

### ASCII only

Everything written in this repository - code, comments, Markdown, commit
messages, PR descriptions - uses only characters reachable from a keyboard.
No em or en dashes, no typographic quotes, no arrows, no box-drawing
characters, no section signs.

Use `-` for a dash, `...` for an ellipsis, `->` and `<-` for arrows, `-`, `|`
and `+` for diagrams, and `#3.6` to point at a numbered section
(`data-model.md #3.6`). Prefer `;` where a list separator is needed in prose.

The reason is editing friction: a character nobody can type is a character
nobody fixes a typo next to, and it arrives inconsistently depending on which
editor or paste buffer produced it. Non-ASCII inside string literals that a
test genuinely needs is written as an escape (`"caf\u00e9"`), so the source
file itself stays ASCII.

### Keep it minimal

- **Solve the problem in front of you.** No speculative parameters, no
  "we might need this later" hooks, no abstraction with a single
  implementation. A second caller justifies an abstraction; anticipating one
  does not.
- **Take the direct route.** If a plain function, an early return, or a
  language built-in does the job, use it. Indirection has to earn itself - a
  layer nobody needs is a layer everybody reads. Do not add a wrapper, a
  registry, a factory or an options object to avoid writing the obvious thing.
- **One way to do each thing.** Two helpers that overlap will drift, and the
  next reader has to work out which one is current. Extend the existing one.
- **Delete rather than accumulate.** Dead branches, unused exports, leftover
  helpers from a refactor, commented-out code. Git remembers; the file should
  not.
- **Name things so the code reads as a sentence.** A well-named helper beats a
  comment explaining a badly-named one, and costs nothing at runtime.
- **Let the types carry the weight.** Make illegal states unrepresentable
  rather than validating them at every call site. Brand identifiers, narrow
  unions, no `any`.

Short is a consequence of being direct, not a target in itself. Do not
compress by removing names, collapsing branches into ternaries, or golfing.

### Comment only when a comment is load-bearing

This repository carries an unusually heavy written record - five architecture
specs in `docs/architecture/`, plus the product context and 20 ADRs on disk.
Rationale belongs there, where it is versioned, indexed and findable.
Duplicating it in comment blocks means two copies that drift, and the code copy
is the one nobody updates.

- Do not restate the code. If a comment paraphrases the line under it, delete
  it and name things better instead.
- Do not explain a decision in a comment. Point at the architecture spec that
  carries it (`data-model.md #3.6`) and let it do the work. Never cite an ADR
  number or `PRODUCT.md` - those files are not pushed, so the reference would
  resolve for nobody but you.
- Do not write JSDoc for self-evident signatures. Types already say it.
- Do not leave section banners, `// eslint-disable` without a reason, or
  scaffolding comments describing what you are about to write.

Comment only where a reader would otherwise be misled or would reintroduce a
bug: a non-obvious invariant, a deliberate deviation from the expected
approach, a subtle case the code cannot express, or a bug that was actually
hit once. Name the concrete failure when there was one. Those are worth a
line - and a line is usually enough.

## Toolchain constraints

Several of these look like bugs. They are not - do not "fix" them.

- **TypeScript is pinned to 6.x** in the `catalog:` in `pnpm-workspace.yaml`.
  TS 7 builds this workspace fine, but typescript-eslint 8 refuses to load
  against it, which would silently drop the type-aware lint pass.
- **Biome owns formatting and most linting.** `eslint.config.js` is
  deliberately thin - type-aware rules only. If a rule does not need type
  information, it belongs in `biome.json` or nowhere.
- **`biome.json` takes no comments.** A `//` line does not fail loudly - Biome
  discards the whole config and falls back to its defaults, so the next
  `pnpm lint:fix` silently reformats the entire repository to tabs at 80
  columns. This has happened once.
- **Tests are typechecked but not built.** Each package's `tsconfig.json`
  excludes `*.test.ts`; a sibling `tsconfig.test.json` typechecks them with
  `noEmit`. Including tests in the build puts compiled copies in `dist`, and
  Vitest then discovers and runs every suite twice.
- **`packages/core/tsconfig.json` sets `"types": []` on purpose.** With no
  ambient type packages and no DOM library, `node:fs` does not resolve and
  `process` is not declared, so the no-I/O boundary fails the build instead of
  failing review. The resulting error suggests installing `@types/node` - that
  is the wrong fix; move the I/O to `@keepcv/db` or `@keepcv/api`. Web Crypto's
  `getRandomValues` is `declare`d locally in `identity/uuid.ts` for the same
  reason.
- **Dependency versions live in the `catalog:`**, one per dependency
  repo-wide. Add versions there, and reference `"catalog:"` in package
  manifests.
- **PostgreSQL is the only dialect**, local and hosted. Local uses PGlite
  (real Postgres in WASM, no Docker). Do not introduce SQLite.

## How work is organised

Features ship **complete**. A sub-feature is not started or done; there is no
partial state on `main`. The Definition of Complete is in
`docs/architecture/capabilities.md` and mirrored in the PR template.

Every feature issue answers: *which felt pain does this trace to?* and *what
are the declared non-goals?* The second is where scope pressure gets absorbed -
a good idea arriving mid-build becomes a new issue, not a bigger current one.

`main` is the default branch; branch before committing.

### Commits and pull requests stand alone

A commit message and a PR description are read by someone who has only that
one thing in front of them - a `git log` line months later, a reviewer opening
a diff cold, a bisect landing mid-history.

- **No cross-references to other commits or PRs.** Not "as in the previous
  PR", not "completes what #12 started", not "see the earlier commit". If
  context from elsewhere matters, restate it in a sentence. A reader following
  a link has already lost the thread, and the link rots the moment history is
  rewritten or a branch is squashed.
- **No ADR numbers and no `PRODUCT.md`.** Both are gitignored, so the citation
  resolves for nobody reading on GitHub. Write the reasoning out instead. Code
  comments may point at `docs/architecture/`, which is tracked; a commit
  message or PR body should still spell the reasoning out, because it is read
  away from the repository.
- **Describe this change and why, not the sequence it sits in.** Naming the
  capability it delivers (`F0.3`) is fine - that is a stable identifier, not a
  pointer at another artifact.
