# Contributing to KeepCV

Development setup, validation and contribution workflow. See the
[documentation index](docs/README.md) for product guides and architecture.

## The one rule

**Nothing the user wrote is ever destroyed.** Soft-delete rather than delete,
append rather than overwrite, archive rather than remove. If a change makes it
possible to lose content, it is wrong, however convenient it is.

## Features ship complete

`main` is the default branch; branch before committing. Name features rather
than numbering them. Size each change by a complete behavior, not by a single
capability bullet.

There are no release phases and no partial features on `main`. Work is
organised as capabilities broken into sub-features, and a sub-feature is either
**not started** or **complete**.

"Complete" means the checklist in the pull request template: schema, API, full
UI including error and empty states, tests, accessibility and docs. Not most of
it.

Every feature issue answers two questions:

- **Which felt pain does this trace to?** Not a hypothetical user, not a
  competitor's feature list. A feature that cannot answer this is closed.
- **What are the declared non-goals?** This is where scope pressure gets
  absorbed. A good idea arriving mid-build becomes a new issue, not a bigger
  current one.

## Getting set up

Requires Node 24+ and pnpm via corepack.

```sh
corepack enable
pnpm install
```

On Windows, enable **Developer Mode** (Settings -> System -> For developers)
before cloning, and set `git config core.symlinks true`. The repository
contains a symlink - `CLAUDE.md` -> `AGENTS.md` - and without both of those git
silently checks it out as a text file containing the target path.

| Command | What it does |
|---|---|
| `pnpm lint` | Biome - formatting and the bulk of linting |
| `pnpm lint:fix` | Biome, applying fixes |
| `pnpm lint:types` | ESLint - the type-aware rules only |
| `pnpm typecheck` | `tsc` across every package, including tests |
| `pnpm test` | Vitest across every package |
| `pnpm check` | Typecheck, tests, both lint passes and release-script tests |
| `pnpm build` | Build packages and applications |
| `pnpm changeset` | Record a change for the next release |
| `pnpm release:check` | Build, pack and exercise an isolated install |

CI runs the required checks; use `pnpm release:check` to validate an isolated
installation before a release.

### Run and validate locally

Run the whole thing on this machine - store, API and web app - against a
throwaway data directory. It prints a URL with the launch token in the fragment;
open that one, because the app has no other way to get a token:

```sh
pnpm build && node apps/cli/dist/index.js serve --data-dir ./.keepcv-scratch
```

The scratch directory is ignored; reuse it to keep development data between runs.

The web app on its own, against a launcher already running on 4319:

```sh
pnpm --filter @keepcv/web dev
```

Single test file, or single test by name:

```sh
pnpm --filter @keepcv/core exec vitest run src/ordering/sort-key.test.ts
pnpm --filter @keepcv/core exec vitest run -t "produces the first key"
```

Generated artifacts fail CI when the committed copy has drifted. Re-emit
in the same commit as the change, and read generated SQL before committing - a
destructive migration step does not merge:

```sh
pnpm --filter @keepcv/schema schema:emit   # the published JSON Schema
pnpm --filter @keepcv/db db:generate       # migrations, from the Drizzle schema
```

The repository contract suite runs against PGlite by default. Point it at a
server PostgreSQL to run both, which is what CI does:

```sh
DATABASE_URL=postgres://... pnpm --filter @keepcv/db test
```

## Architecture and coding rules

Read the [architecture specifications](docs/README.md#architecture) before
changing the behavior they describe. Package responsibilities and the enforced
layer boundaries live in [Application Structure](docs/architecture/application-structure.md#2-package-responsibilities).
Every package declares its direct dependencies; do not rely on hoisting.

Follow the [coding rules](AGENTS.md#code-style) and
[toolchain constraints](AGENTS.md#toolchain-constraints), including ASCII-only
source, type-aware ESLint rules and catalog-managed dependency versions.

## Verify by trying to break it

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

## Commits and releases

Conventional commits.

**A change to a package needs a changeset.** Write one with `pnpm changeset`.
CI runs `changeset status --since=origin/main`, which fails a pull request that
changes a package and adds no changeset at all. It cannot tell that every
changed package was described - changesets has no per-package mode - so name
each one the change touches, and expect a reviewer to check.

The gate ignores `*.test.ts`, `*.test.tsx` and `*.harness.ts`, because a change
confined to those has nothing to say in a changelog. Anything else that
genuinely does not - a comment, a rename nobody can observe - takes
`pnpm changeset add --empty`, which records that the omission was a decision.

Write each changeset for someone reading the changelog with no other context.
Versioning consumes those entries into package changelogs. A versioning change
adds a deliberate empty changeset afterwards, so the same CI gate applies
without requesting another version bump.

See [Releasing](docs/RELEASING.md) for preparation, package validation and
publishing. The GitHub Release workflow publishes after the versioning change
has passed review and CI and is synchronized to `release/<version>`. Select that
branch and a mode when running the workflow; the version comes from the branch
and package metadata. The maintainer approves the `npm` environment to publish.

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
