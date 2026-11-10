# @keepcv/api

## 0.5.1

### Patch Changes

- Updated dependencies
  - @keepcv/schema@0.4.0
  - @keepcv/core@0.5.0
  - @keepcv/templates@0.2.2

## 0.5.0

### Minor Changes

- 9f5deba: Expose consumer-controlled assistant presentation, trusted authorization scopes,
  ongoing authorization and cancellation, effective file/turn limits and bounded
  provider usage reporting. Keep existing conversations, original attachments,
  ordinary editing and export accessible when generation is disabled. Preserve
  custom model compatibility and document process-local authority and commit races.

  Improve the conversation experience with readable change previews, accessible
  message/status feedback, keyboard submission, correction drafts, copy controls
  and duplicate-decision protection.

- 9f5deba: Add a conversational home and contextual assistant with configurable model routes,
  reviewable resource changes, bounded edit permissions and native hosted research.
  Retain conversations, receipts and original PDF, image and UTF-8 attachments in
  native backups. Existing editing and export remain usable without a model service.

### Patch Changes

- 9f5deba: Bound process-local proposal, grant and revocation state. Reclaim committed
  admissions, expire pending review authority and grants, and retire a runtime
  instead of forgetting revoked scopes at capacity. Make close terminal while
  preserving durable receipt replay in a fresh authorized runtime.

  Report Stop against an unowned running lease as 409 with expiry guidance. Local
  cancellation never clears another process's lease or reverses committed changes;
  the editor displays that guidance without claiming completion.

- Updated dependencies [9f5deba]
- Updated dependencies [9f5deba]
- Updated dependencies [9f5deba]
  - @keepcv/core@0.4.0
  - @keepcv/schema@0.3.0
  - @keepcv/templates@0.2.1

## 0.4.0

### Minor Changes

- ce781cd: Add versioned Default and HTML template definitions, a bounded data-binding
  language, checked HTML/CSS/local assets and a source-file builder with selected
  resume data discovery. Ship Studio, Signal and Folio system templates, including
  two creative layouts. Keep system templates read-only and owned copies editable.

  Render HTML previews and exports in cancellable browser workers. Preserve legacy
  templates and pinned history, migrate native archives to v2 without rewriting
  manifests, and retain unavailable future types for source recovery and backups.

  Ignore initial blank iframe loads before printing and keep the print frame
  script-free.

### Patch Changes

- Updated dependencies [ce781cd]
- Updated dependencies [ce781cd]
  - @keepcv/schema@0.2.0
  - @keepcv/templates@0.2.0
  - @keepcv/core@0.3.0

## 0.3.0

### Minor Changes

- 11a9291: Accept an optional cancellation signal on UnitOfWork.run and forward incoming
  Request signals from API content transactions. Server PostgreSQL cancels queued
  acquisition and active backend work, refuses late statements, and cleans up
  without replaying callbacks. Preserve operation errors through rollback failure
  and distinguish confirmed commits from ambiguous disconnects. PGlite checks
  cancellation at transaction and callback boundaries; lifecycle work keeps its
  independent defaults.

### Patch Changes

- Updated dependencies [11a9291]
  - @keepcv/core@0.2.0

## 0.2.1

### Patch Changes

- Update packaged metadata for the database development dependency.

## 0.2.0

### Minor Changes

- 5c9dc58: Add optional `reportUnexpectedError` to `createApi` and `problemFor`. Consumers
  can disable default console reporting with `null` or supply their own reporter.
  Reporter failures do not change client problems or produce fallback console
  output. Expected problems retain their existing behavior and are not reported.

## 0.1.4

### Patch Changes

- Updated dependencies
  - @keepcv/core@0.1.4

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

- 9b4555f: Add the HTTP boundary: `createApi` over the repository port, the owned
  collections and the nested routes hanging off them, the boot payload, native
  export and import, intake, resume compilation and the version timeline, RFC
  9457 `problem+json` errors, a generated OpenAPI document and a typed client.
  `createApi` takes the port, an owner scope and an `authenticate` function, and
  knows nothing about a driver or a port number.

### Patch Changes

- Updated dependencies [9b4555f]
- Updated dependencies [d47dc1b]
- Updated dependencies [9b4555f]
  - @keepcv/core@0.1.0
  - @keepcv/schema@0.1.0
