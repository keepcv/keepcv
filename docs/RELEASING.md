# Releasing KeepCV

Releases are published through GitHub Actions. The public packages are `keepcv`
and `@keepcv/api`, `@keepcv/ats-lint`, `@keepcv/core`, `@keepcv/db`,
`@keepcv/interop`, `@keepcv/render`, `@keepcv/schema` and `@keepcv/templates`.
The workspace root and `@keepcv/web` are private.

## How the pipeline works

1. Prepare versions and changelogs with Changesets on a branch, then review and
   merge the pull request. The first release is already prepared as `0.1.0`.
2. Run **Actions -> Release -> Run workflow**, selecting `main`, the prepared
   launcher version, and a mode. `verify` is the default and publishes nothing.
3. The existing test workflow runs on that exact commit, including both database
   drivers, generated-file checks and an isolated install of the packed packages.
   Release builds do not restore dependency or build caches.
4. The verified tarballs, SHA-512 digests, commit and release notes are uploaded
   as a run artifact retained for 14 days.
5. For `trusted` or `bootstrap` mode, the publish job waits for approval in the
   `npm` environment. It downloads that run's artifacts, checks their digests,
   commit and version, then publishes with provenance and lifecycle scripts
   disabled. It does not check out source or install project dependencies.
6. A separate job with GitHub write permission creates package tags and a GitHub
   release named `keepcv@<version>`, attaching all tarballs and `release.json`.

Only `main` in `keepcv/keepcv` can release. Concurrent releases are serialized;
an in-progress publish is never cancelled by a newer run. The build job has no
publish credentials, the publish job has no GitHub write permission, and the
announcement job has no npm credentials or OIDC permission.

## One-time GitHub setup

Create the `npm` environment in **Settings -> Environments**:

It has been configured for `keepcv/keepcv` with `nipunrautela` as reviewer.
Check these settings if the environment is recreated:

- Restrict deployments to the `main` branch.
- Require a maintainer review. A sole maintainer must be allowed to approve
  their own manually dispatched run.
- Disable administrator bypass of the environment protection rules.

Keep the existing pull-request and required-check rules on `main`. Actions are
pinned to commit SHAs with readable version labels; Dependabot proposes weekly
updates. This
pipeline uses the built-in `GITHUB_TOKEN` and needs no personal GitHub token or
permission for Actions to create pull requests.

## Bootstrap the first npm release

npm trusted publishers are configured on existing packages. New packages need
an initial authenticated publication before that trust can be registered.

1. Sign in to npm, enable 2FA, and confirm you can publish `keepcv` and packages
   in the `@keepcv` scope. A registry 404 does not prove name ownership.
2. Create a short-lived granular token with **Read and write (publish and
   stage)** and **Bypass two-factor authentication** for this initial CI publish.
   Scope it as narrowly as npm permits while allowing creation of the missing
   packages; an uncreated unscoped name may require All Packages temporarily.
   Organisation management permissions are not needed.
3. Add it as the **environment secret** `NPM_BOOTSTRAP_TOKEN` in `npm`. Never
   put the value in a workflow input, issue, repository file or chat.
4. Run Release with version `0.1.0` and mode `verify`. Inspect the artifacts and
   logs, then run with mode `bootstrap` and approve the publish job.
5. After publication, configure trusted publishing on each of the nine npm
   packages using these exact values:

   | Setting | Value |
   |---|---|
   | Provider | GitHub Actions |
   | Organisation or user | `keepcv` |
   | Repository | `keepcv` |
   | Workflow filename | `release.yml` |
   | Environment | `npm` |
   | Allowed action | Enable `npm publish` explicitly |

6. Revoke the bootstrap token and delete the GitHub environment secret. Use
   `trusted` mode thereafter. After the first successful OIDC publish, set npm
   publishing access to require 2FA and disallow traditional tokens.

The bootstrap token is temporary. npm has announced that direct publishing with
bypass-2FA tokens ends in January 2027; do not retain this as the regular release
path. npm's newer staged-publishing flow is an alternative if policy requires
approval on npm itself, but this pipeline uses the GitHub environment approval.

## Preparing later versions

Use Node 24+ and the pnpm version pinned in `package.json`, on a clean branch:

```sh
pnpm install --frozen-lockfile
pnpm changeset status
pnpm version-packages
pnpm changeset add --empty
```

Review versions and changelogs and write `docs/releases/<launcher-version>.md`.
The empty changeset records that versioning consumed the descriptions; the
ordinary CI changeset gate still applies without requesting another bump.
Do not run versioning again on an already prepared release. The release workflow
refuses pending version bumps or a launcher version different from its input.

Validate locally with `pnpm check` and `pnpm release:check`. The latter requires
network access, packs into `.keepcv-release-check/packages/`, and installs only
the launcher outside the checkout. Overrides resolve unpublished KeepCV
dependencies to the tarballs; third-party dependencies come from the registry.
The temporary installation is removed after the check.

Also exercise a representative resume in the browser: import and review it,
edit a phrasing, tailor the selection, print a PDF, compare history and reopen
the store. Automated package checks cannot judge print layout or usability.

## Recovery and verification

If a run fails after publishing some packages, use **Re-run failed jobs** on the
same run. This reuses the verified artifact from that run. Existing npm versions
are skipped; the remainder publish before the GitHub release is created. Existing
tags and releases are not moved or replaced. Registry errors other than a
missing version fail the run. Never unpublish or overwrite a version to repair
it; correct the problem in a new version.

After the artifact retention window, run a new verification from the same
reviewed commit before retrying. Do not rebuild a failed release from newer
source under the same version number.

After publishing, from outside the checkout:

```sh
npx --yes keepcv@0.1.0 --version
npx --yes keepcv@0.1.0 serve --data-dir ./keepcv-release-smoke
```

Open the complete printed URL and stop with Ctrl+C. Check all nine npm package
versions and their provenance links, and the GitHub release assets. Update the
root and launcher READMEs only after the first release is actually available.

## References and decisions

- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/): workflow
  identity, OIDC, provenance and package-level setup.
- [GitHub Actions security](https://docs.github.com/en/actions/reference/security/secure-use):
  immutable action pins, minimal job permissions and credential isolation.
- [GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments):
  reviewer and branch restrictions.
- [Changesets automation](https://changesets.dev/guide/automating): separate
  version preparation from publishing. This repository retains Changesets 2
  and a reviewed versioning PR; current Changesets Action 2 requires CLI 3.
- [npm's September 2026 roadmap](https://github.com/orgs/community/discussions/208130):
  new-package bootstrapping and the transition away from bypass-2FA tokens.

Publishing is dispatched explicitly rather than triggered by every merge or
tag. This keeps first-release timing deliberate without adding an automatic
version-PR bot or another credential. The maintained Changesets CLI still owns
version calculation and changelogs; the publish job uses npm's supported tarball
and OIDC interfaces for the already-tested artifacts.
