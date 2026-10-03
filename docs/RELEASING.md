# Releasing KeepCV

Releases are published through GitHub Actions. The public packages are `@keepcv/cli`
and `@keepcv/api`, `@keepcv/ats-lint`, `@keepcv/core`, `@keepcv/db`,
`@keepcv/interop`, `@keepcv/render`, `@keepcv/schema` and `@keepcv/templates`.
The workspace root and `@keepcv/web` are private.

## How the pipeline works

1. Prepare versions and changelogs with Changesets on a branch, then review and
   merge the pull request. The first complete release is prepared as `0.1.2`.
2. Synchronize `release/<version>` from reviewed `main`, then run **Actions ->
   Release -> Run workflow**, selecting that branch and a mode. There is no
   version input: the branch suffix must match the launcher package version.
   `verify` is the default and publishes nothing.
3. The existing test workflow runs on that exact commit, including both database
   drivers, generated-file checks and an isolated install of the packed packages.
   Release builds do not restore dependency or build caches.
4. The verified tarballs, SHA-512 digests, commit and release notes are uploaded
   as a run artifact retained for 14 days. A separate job downloads that artifact
   and verifies its bytes, commit and branch version, including in `verify` mode.
   It checks every target npm version before publication: any existing version
   must have the same SHA-512 digest as its reviewed tarball.
5. For `trusted` or `bootstrap` mode, the publish job waits for approval in the
   `npm` environment. It downloads that run's artifacts, checks their digests,
   commit and version, then publishes with provenance and lifecycle scripts
   disabled. It does not check out source or install project dependencies.
6. A separate job with GitHub write permission creates package tags and a GitHub
   release named `@keepcv/cli@<version>`, attaching all tarballs and `release.json`.

Only `release/<version>` branches in `keepcv/keepcv` can release. The version
must be stable semver, such as `release/0.1.2`; `main`, tags, prereleases and
version mismatches fail validation. Concurrent releases are serialized;
an in-progress publish is never cancelled by a newer run. The build job has no
publish credentials, the publish job has no GitHub write permission, and the
announcement job has no npm credentials or OIDC permission.

## One-time GitHub setup

The `npm` environment in **Settings -> Environments** has been configured for
`keepcv/keepcv` with `nipunrautela` as reviewer.
Check these settings if the environment is recreated:

- Restrict deployments to the `release/*` branch pattern.
- Require a maintainer review. A sole maintainer must be allowed to approve
  their own manually dispatched run.
- Disable administrator bypass of the environment protection rules.

Keep the existing pull-request and required-check rules on `main`. Actions are
pinned to commit SHAs with readable version labels; Dependabot proposes weekly
updates. This pipeline uses the built-in `GITHUB_TOKEN` and needs no personal GitHub token or
permission for Actions to create pull requests.

Automatic deletion of merged PR work branches is enabled. Active deletion
rulesets preserve `release/*` branches and all tags. Use `prepare/<version>`
for release preparation PRs, then create the versioned release branch after
merging. Delete merged work branches locally; retain release branches and tags.

## Bootstrap the first npm release

npm trusted publishers are configured on existing packages. New packages need
an initial authenticated publication before that trust can be registered.

1. Sign in to npm, enable 2FA, and confirm you can publish packages in the
   `@keepcv` organization scope, including the new `@keepcv/cli` launcher.
   A registry 404 does not prove publication permission.
2. Create a short-lived granular token with **Read and write (publish and
   stage)** and **Bypass two-factor authentication** for this initial CI publish.
   Limit package access to the `@keepcv` scope while allowing creation of missing
   packages in that scope.
   Organisation management permissions are not needed.
3. Add it as the **environment secret** `NPM_BOOTSTRAP_TOKEN` in `npm`. Never
   put the value in a workflow input, issue, repository file or chat.
4. Run Release from branch `release/0.1.2` with mode `verify`. Inspect the
   artifacts and logs, then run from the same branch with mode `bootstrap` and
   approve the publish job. No version needs to be typed.
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
refuses pending version bumps or a launcher version different from its branch.

After the preparation PR passes CI and merges into `main`, create the release
branch from that reviewed revision. For an existing release branch, merge
`main` into it and resolve any conflicts before pushing. Keep release fixes in
reviewed PRs to `main`, then synchronize the release branch again. A push never
publishes; start the workflow manually when the branch is ready.

For example, after merging preparation for `0.2.0`:

```sh
git fetch origin
git switch -c release/0.2.0 origin/main
git push -u origin release/0.2.0
gh workflow run release.yml --ref release/0.2.0 -f mode=verify
```

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
are skipped only when their digests match the verified tarballs. Every version
is checked before any package is published, and the announcement job checks
them again before creating tags. A conflicting existing version stops the run;
prepare a new version for the complete package set instead of rerunning it.
All missing packages are submitted before waiting for availability, so their
scans can proceed together. Registry visibility and complete integrity metadata
are checked every thirty seconds for up to thirty minutes; verified packages
are removed from subsequent lookups. A visible digest mismatch fails immediately.
The publish job allows fifty minutes for submission and verification. Existing
tags and releases are not moved or replaced. Registry errors other than a
missing version fail the run. Never
unpublish or overwrite a version to repair it.

The partial `0.1.0` bootstrap published five libraries before an immediate
registry lookup failed. Its pre-existing `@keepcv/core@0.1.0` lacked runtime
files and did not match the reviewed tarball. The launcher was not published.
The `0.1.1` attempt published all eight libraries, but its token could not create
the unscoped launcher. `0.1.2` publishes the launcher as `@keepcv/cli` and uses
matching internal versions across the complete package set. Do not rerun the
earlier bootstrap attempts.

npm scans newly published versions before making them installable. npm reports
a typical delay of around five minutes, sometimes fifteen minutes or more.
A successful `npm publish` therefore does not prove immediate availability.
If the wait expires, check npm notifications for a scan hold or rejection and
confirm the accepted versions are visible before retrying; a 404 alone does not
prove a version was never submitted.

After the artifact retention window, run a new verification from the same
reviewed commit before retrying. Do not rebuild a failed release from newer
package contents under the same version number. A workflow-only repair can
rebuild from a newer reviewed commit, provided every package digest matches the
previous artifact before retrying. If any package differs, prepare a new version
for the complete package set.
Repacking can change digests when pnpm reorders dependency keys in a manifest;
even when runtime files match, a published version still requires its exact
reviewed artifact for recovery.

After publishing, from outside the checkout:

```sh
npx --yes @keepcv/cli@0.1.2 --version
npx --yes @keepcv/cli@0.1.2 serve --data-dir ./keepcv-release-smoke
```

Open the complete printed URL and stop with Ctrl+C. Check all nine npm package
versions and their provenance links, and the GitHub release assets. Update the
root and launcher READMEs only after the first release is actually available.

## References and decisions

- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/): workflow
  identity, OIDC, provenance and package-level setup.
- [npm publish-time scanning](https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/):
  availability delays after a successful publish.
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
