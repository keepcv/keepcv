# Contributing to KeepCV

Thanks for looking. A few things about how this project works, because some of
them are unusual.

## The one rule

**Nothing the user wrote is ever destroyed.** Soft-delete rather than delete,
append rather than overwrite, archive rather than remove. If a change makes it
possible to lose content, it is wrong, however convenient it is.

This is not a style preference - it is the entire reason the project exists.

## Features ship complete

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
| `pnpm check` | All of the above |
| `pnpm changeset` | Record a change for the next release |

All of these run in CI and all must pass.

## Repository layout

```
packages/schema   Zod definitions - the single source of truth for shared shapes
packages/core     Domain logic. Pure: no I/O, no database, no network
packages/db       Drizzle schema, migrations, repository implementations
apps/             Applications
```

Two boundaries are enforced rather than merely encouraged:

- **`@keepcv/core` has no I/O.** No filesystem, no network, no drivers, no Node
  built-ins. It runs unchanged in Node and in the browser, which is what lets
  the resume preview and the exported file be produced by the same code.
- **Every package declares what it imports.** No relying on hoisting.

## Toolchain notes

- **Biome owns formatting and most linting.** Do not add stylistic rules to
  `eslint.config.js`; if a rule does not need type information, it belongs in
  `biome.json` or nowhere.
- **TypeScript is pinned to 6.x.** typescript-eslint does not yet load against
  TypeScript 7, and the type-aware rules are the only reason ESLint is here.
- **Dependency versions live in the `catalog:` in `pnpm-workspace.yaml`**, one
  version per dependency across the repo. Upgrade there, not per package.

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

Nothing has been published, so the changesets on `main` describe a first
release rather than a diff from one. Write each entry for someone reading the
changelog with no other context.
