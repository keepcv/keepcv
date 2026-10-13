# @keepcv/cli

## 0.1.6

### Patch Changes

- Updated dependencies
- Updated dependencies [3252841]
  - @keepcv/api@0.2.1
  - @keepcv/db@0.2.2

## 0.1.5

### Patch Changes

- Updated dependencies [5c9dc58]
  - @keepcv/api@0.2.0

## 0.1.4

### Patch Changes

- Updated dependencies
  - @keepcv/core@0.1.4
  - @keepcv/api@0.1.4
  - @keepcv/db@0.2.1
  - @keepcv/interop@0.1.4

## 0.1.3

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

- 56f588e: Publish the browser editor with an injected typed API client, QueryClient and
  optional sign-out callback, compiled styles and browser assets. The local app
  uses the same entry. Verify keyboard navigation, writes and asset consumption
  from packed packages installed outside the workspace.
- Updated dependencies [07ef669]
- Updated dependencies [c0e1bf3]
- Updated dependencies [6b46294]
  - @keepcv/db@0.2.0
  - @keepcv/api@0.1.3
  - @keepcv/interop@0.1.3
  - @keepcv/render@0.1.3
  - @keepcv/schema@0.1.3
  - @keepcv/ats-lint@0.1.3
  - @keepcv/core@0.1.3

## 0.1.2

### Patch Changes

- Publish the complete package set under the @keepcv organization, with the launcher named @keepcv/cli and its executable still named keepcv. Use fresh matching internal versions after the library-only 0.1.1 publication.
- Updated dependencies
  - @keepcv/api@0.1.2
  - @keepcv/ats-lint@0.1.2
  - @keepcv/core@0.1.2
  - @keepcv/db@0.1.2
  - @keepcv/interop@0.1.2
  - @keepcv/render@0.1.2
  - @keepcv/schema@0.1.2

## 0.1.1

### Patch Changes

- Publish the complete package set with matching internal dependencies after the partial 0.1.0 publication. Validate all existing registry versions against the reviewed tarballs before publication, and wait for registry propagation after each publish.
- Updated dependencies
  - @keepcv/api@0.1.1
  - @keepcv/ats-lint@0.1.1
  - @keepcv/core@0.1.1
  - @keepcv/db@0.1.1
  - @keepcv/interop@0.1.1
  - @keepcv/render@0.1.1
  - @keepcv/schema@0.1.1

## 0.1.0

### Minor Changes

- 9b4555f: Add the launcher. `serve` opens the store, runs pending migrations and serves
  the API and the web app on one origin, with the launch token in the URL
  fragment; `render`, `status`, `backup`, `restore` and `set-password` round it
  out. `--auth token`, `--auth password` and `--auth proxy` all answer one owner,
  and binding off loopback refuses `token`. The built web app ships inside the
  package, so an install carries its own interface. Requires Node 24 or newer.

### Patch Changes

- Updated dependencies [9b4555f]
- Updated dependencies [9b4555f]
- Updated dependencies [9b4555f]
- Updated dependencies [d47dc1b]
- Updated dependencies [9b4555f]
- Updated dependencies [9b4555f]
- Updated dependencies [9b4555f]
- Updated dependencies [9b4555f]
  - @keepcv/api@0.1.0
  - @keepcv/ats-lint@0.1.0
  - @keepcv/core@0.1.0
  - @keepcv/schema@0.1.0
  - @keepcv/db@0.1.0
  - @keepcv/interop@0.1.0
  - @keepcv/render@0.1.0
