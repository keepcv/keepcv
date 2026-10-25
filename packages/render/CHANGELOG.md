# @keepcv/render

## 0.2.0

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
  - @keepcv/templates@0.1.3

## 0.1.2

### Patch Changes

- Publish the complete package set under the @keepcv organization, with the launcher named @keepcv/cli and its executable still named keepcv. Use fresh matching internal versions after the library-only 0.1.1 publication.
- Updated dependencies
  - @keepcv/schema@0.1.2
  - @keepcv/templates@0.1.2

## 0.1.1

### Patch Changes

- Publish the complete package set with matching internal dependencies after the partial 0.1.0 publication. Validate all existing registry versions against the reviewed tarballs before publication, and wait for registry propagation after each publish.
- Updated dependencies
  - @keepcv/schema@0.1.1
  - @keepcv/templates@0.1.1

## 0.1.0

### Minor Changes

- 9b4555f: Add `renderHtml` and `renderSite`: one self-contained HTML document with the
  template's stylesheet inlined and nothing to fetch when it opens, and the
  portfolio site over that same document. The stylesheet already carries `@page`,
  physical units and break rules, so printing the file is the PDF export.
  `fileNameFor` names the file it produces.

### Patch Changes

- Updated dependencies [d47dc1b]
- Updated dependencies [9b4555f]
- Updated dependencies [9b4555f]
  - @keepcv/schema@0.1.0
  - @keepcv/templates@0.1.0
