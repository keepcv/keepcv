# @keepcv/templates

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

- ce781cd: Create reusable templates with a visual builder, explicit saving, undo/redo,
  recovery and sample or real-resume previews. Add six read-only system designs
  while preserving original templates for existing resumes and history.

  Simplify resume Design around the paper, stage template choices before Apply,
  preserve fit settings across template changes, and keep PDF export in the
  workspace header with other formats in a separate dialog. Fix preview margins
  and add zoom and page navigation.

### Patch Changes

- Updated dependencies [ce781cd]
  - @keepcv/schema@0.2.0

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

## 0.1.2

### Patch Changes

- Publish the complete package set under the @keepcv organization, with the launcher named @keepcv/cli and its executable still named keepcv. Use fresh matching internal versions after the library-only 0.1.1 publication.
- Updated dependencies
  - @keepcv/schema@0.1.2

## 0.1.1

### Patch Changes

- Publish the complete package set with matching internal dependencies after the partial 0.1.0 publication. Validate all existing registry versions against the reviewed tarballs before publication, and wait for registry propagation after each publish.
- Updated dependencies
  - @keepcv/schema@0.1.1

## 0.1.0

### Minor Changes

- 9b4555f: Add the template contract and the designs built on it. A template is data:
  `fromSpec` over a `TemplateSpec`, with `FIT_KNOBS` naming what a resume may
  move and `DESIGN_KNOBS` what it may not, and settings declared as `fields` the
  caller renders. A template reaches nothing - it is handed a `ResumeDocument`
  and its own configuration, and answers markup and the stylesheet for it.

### Patch Changes

- Updated dependencies [d47dc1b]
- Updated dependencies [9b4555f]
  - @keepcv/schema@0.1.0
