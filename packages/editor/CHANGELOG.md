# @keepcv/editor

## 0.9.0

### Minor Changes

- af3b8e3: Let the assistant choose web queries and follow result links when Web search is
  on. Remove exact-query and page approval forms, make server domain filters
  optional, support web configuration on the existing inference route, and retain
  larger fetched findings. Keep execution reporting, source provenance and current
  owner/session authority.

  Replace the expanded composer controls with a plus menu and removable active
  chips. Move sharing, task permissions and file limits into a settings dialog,
  with keyboard navigation and a session-scoped sharing acknowledgment. Configured
  web access starts on and the choice carries across conversations.

## 0.8.0

### Minor Changes

- c3c0ef1: Add separately approved public page reads and explicit bounded external search
  and fetch engines. Require reported tool execution, observe external calls
  separately from tokens, and retain requested-page provenance on interrupted
  conversations. Document provider-side confinement limits and deployment
  limitations. Add a composer Web search toggle, capability availability and a
  per-turn switch that removes the search tool when disabled. Ordinary editing
  and export remain independent.

### Patch Changes

- Updated dependencies [c3c0ef1]
  - @keepcv/schema@0.5.0
  - @keepcv/api@0.6.0
  - @keepcv/core@0.6.0
  - @keepcv/ats-lint@0.1.7
  - @keepcv/interop@0.1.9
  - @keepcv/render@0.2.3
  - @keepcv/templates@0.2.3

## 0.7.0

### Minor Changes

- Adopt the Index Drawer identity across navigation, entry screens and the browser favicon. Add shared vector branding and matching store, selection and snapshot illustrations with light and dark theme support.
- Unify assistant chat and conversation history in one workspace with searchable history and a compact composer. Keep the application sidebar focused on navigation, change reviews, attachments and explicit sharing controls accessible, route contextual requests to the assistant workspace and remove expected stream-abort errors after Stop.
- Show assistant tool names and their purpose directly in the chat during execution and in saved replies. Preserve this optional activity in conversation history and native archives, including interrupted replies. Existing messages and custom model adapters remain compatible.

  Clarify that adding a Point creates its phrasing set, so the model does not propose creating the same set twice.
  Identify attached text files as source material so replies can attribute their contents correctly.
  Separate narration across tool steps into paragraphs in both live and saved messages.

### Patch Changes

- Make Ask KeepCV open a fresh conversation on the Assistant page with removable source-page context, instead of reopening the selected conversation in a modal. Keep the source resource attached to subsequent requests and task permissions.
- Updated dependencies
  - @keepcv/schema@0.4.0
  - @keepcv/core@0.5.0
  - @keepcv/api@0.5.1
  - @keepcv/ats-lint@0.1.6
  - @keepcv/interop@0.1.8
  - @keepcv/render@0.2.2
  - @keepcv/templates@0.2.2

## 0.6.0

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

- 9f5deba: Simplify page headings, panels and guidance. Group template filters and move
  optional chat, summary and restore controls behind accessible disclosures while
  retaining active permissions, authored content and recovery.
- Updated dependencies [9f5deba]
- Updated dependencies [9f5deba]
- Updated dependencies [9f5deba]
  - @keepcv/core@0.4.0
  - @keepcv/api@0.5.0
  - @keepcv/schema@0.3.0
  - @keepcv/interop@0.1.7
  - @keepcv/ats-lint@0.1.5
  - @keepcv/render@0.2.1
  - @keepcv/templates@0.2.1

## 0.5.0

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
- Updated dependencies [ce781cd]
  - @keepcv/schema@0.2.0
  - @keepcv/templates@0.2.0
  - @keepcv/api@0.4.0
  - @keepcv/render@0.2.0
  - @keepcv/core@0.3.0
  - @keepcv/ats-lint@0.1.4
  - @keepcv/interop@0.1.6

## 0.4.2

### Patch Changes

- Updated dependencies [11a9291]
  - @keepcv/core@0.2.0
  - @keepcv/api@0.3.0
  - @keepcv/interop@0.1.5

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
