# @keepcv/editor

## 0.4.1

### Patch Changes

- 9cf7fda: Preserve unfinished Job target, Profile, Record, Point, metrics, Evidence, record links/fields and contact inputs through refused saves, navigation and sign-out. Scope recovery to the connected store, retain conflict tokens, and clear only acknowledged or explicitly discarded copies.
- Updated dependencies
  - @keepcv/api@0.2.1

## 0.4.0

### Minor Changes

- 5c9dc58: Add an optional `recoveryNamespace` to `Editor` so pending wording, template
  designs and resume settings stay with the connected store when imported ids
  overlap. Failed saves and sign-out preserve recovery for each namespace.
  Omitting it retains standalone recovery, including existing unscoped edits;
  scoped connections leave those legacy copies untouched.

### Patch Changes

- Updated dependencies [5c9dc58]
  - @keepcv/api@0.2.0

## 0.3.0

### Minor Changes

- Make editor workflows clearer with concise copy, expandable optional controls,
  themed native dropdowns, Overview import access, and template selection during
  resume creation. Keep failed resume and design creations open for retry.

  Make record summaries editable, expand alternate wordings and nested resume
  points on demand, and provide a short content reference with paths back to
  parent records. Distinguish repeated job titles in pickers and show which
  resumes use a summary's default wording.

  Expose optional data-page guidance for editor consumers, including the ability
  to omit terminal instructions while retaining browser backup and restore.

  Stop requesting end dates for single-date records and languages.

### Patch Changes

- Updated dependencies
  - @keepcv/core@0.1.4
  - @keepcv/api@0.1.4
  - @keepcv/interop@0.1.4

## 0.2.0

First publication of the reusable browser editor.

### Minor Changes

- 56f588e: Publish the browser editor with an injected typed API client, QueryClient and
  optional sign-out callback, compiled styles and browser assets. The local app
  uses the same entry. Verify keyboard navigation, writes and asset consumption
  from packed packages installed outside the workspace.

### Patch Changes

- Updated dependencies [c0e1bf3]
- Updated dependencies [6b46294]
  - @keepcv/api@0.1.3
  - @keepcv/interop@0.1.3
  - @keepcv/render@0.1.3
  - @keepcv/schema@0.1.3
  - @keepcv/templates@0.1.3
  - @keepcv/ats-lint@0.1.3
  - @keepcv/core@0.1.3
