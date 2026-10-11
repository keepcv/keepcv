# @keepcv/db

## 0.2.1

### Patch Changes

- Updated dependencies
  - @keepcv/core@0.1.4

## 0.2.0

### Minor Changes

- 07ef669: Add atomic, retry-safe owner provisioning and explicitly confirmed owner
  erasure outside the editing repositories. Preserve filled profiles on retries
  and recover from interrupted provisioning. Expose connection limits, connection
  and idle timeouts, statement timeouts and validated TLS CA configuration.
  Validate the configured TLS hostname for IP connections and prevent URL SSL
  parameters from overwriting that check.
  Run migration locking and migration SQL on the same connection, including
  single-connection pools, and make shutdown safe to await more than once.

### Patch Changes

- c0e1bf3: Revoke running password sessions when credentials change, bound concurrent
  sign-in attempts and request bodies, and keep private API responses out of caches.
  Protect launcher data and native backups with private filesystem permissions.

  Reject fetching CSS in new designs after decoding escapes, preserve older CSS
  in native archives, and omit unsafe CSS when rendering with a warning. Exported
  HTML and site files carry a Content Security Policy.

  Bound DOCX inflation and browser source files, move Word extraction to a
  cancellable worker, and update dependencies with security fixes.

- 6b46294: Exclude source and declaration maps from npm packages while retaining runnable
  JavaScript and TypeScript declarations.

  Record current-resume exports in history, reject history capture for a stale
  preview, preserve formatting through phrasing edits and recovery, and retain
  pending settings across navigation and failed saves. Add phrasing comparison
  and reapply controls and isolate repeated titles in import review.

  Validate launcher Host and Origin before routing requests, apply a same-origin
  Content Security Policy, and require a declared public origin for network binds.
  Update installation and deployment documentation for the published launcher.

- Updated dependencies [c0e1bf3]
- Updated dependencies [6b46294]
  - @keepcv/schema@0.1.3
  - @keepcv/core@0.1.3

## 0.1.2

### Patch Changes

- Publish the complete package set under the @keepcv organization, with the launcher named @keepcv/cli and its executable still named keepcv. Use fresh matching internal versions after the library-only 0.1.1 publication.
- Updated dependencies
  - @keepcv/core@0.1.2
  - @keepcv/schema@0.1.2

## 0.1.1

### Patch Changes

- Publish the complete package set with matching internal dependencies after the partial 0.1.0 publication. Validate all existing registry versions against the reviewed tarballs before publication, and wait for registry propagation after each publish.
- Updated dependencies
  - @keepcv/core@0.1.1
  - @keepcv/schema@0.1.1

## 0.1.0

### Minor Changes

- 9b4555f: Add the PostgreSQL store: the Drizzle schema for the record store, its
  vocabulary, its editor state, the composition a resume is and its history; the
  migrations that create them; and the repositories implementing the port. The
  same schema and queries run on PGlite locally and on a server PostgreSQL, and
  the contract suite runs against both. `resume_version` and `phrasing_revision`
  are append-only, each held that way by a trigger.

### Patch Changes

- Always advance concurrency tokens, including edits within one millisecond or
  after the application clock moves backward, so stale writes are refused.
- Updated dependencies [9b4555f]
- Updated dependencies [d47dc1b]
- Updated dependencies [9b4555f]
  - @keepcv/core@0.1.0
  - @keepcv/schema@0.1.0
