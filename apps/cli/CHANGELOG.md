# @keepcv/cli

## 0.2.1

### Patch Changes

- Make Ask KeepCV open a fresh conversation on the Assistant page with removable source-page context, instead of reopening the selected conversation in a modal. Keep the source resource attached to subsequent requests and task permissions.
- Adopt the Index Drawer identity across navigation, entry screens and the browser favicon. Add shared vector branding and matching store, selection and snapshot illustrations with light and dark theme support.
- Unify assistant chat and conversation history in one workspace with searchable history and a compact composer. Keep the application sidebar focused on navigation, change reviews, attachments and explicit sharing controls accessible, route contextual requests to the assistant workspace and remove expected stream-abort errors after Stop.
- Show assistant tool names and their purpose directly in the chat during execution and in saved replies. Preserve this optional activity in conversation history and native archives, including interrupted replies. Existing messages and custom model adapters remain compatible.

  Clarify that adding a Point creates its phrasing set, so the model does not propose creating the same set twice.
  Identify attached text files as source material so replies can attribute their contents correctly.
  Separate narration across tool steps into paragraphs in both live and saved messages.

- Updated dependencies
  - @keepcv/schema@0.4.0
  - @keepcv/core@0.5.0
  - @keepcv/agent@0.3.0
  - @keepcv/api@0.5.1
  - @keepcv/ats-lint@0.1.6
  - @keepcv/db@0.4.1
  - @keepcv/interop@0.1.8
  - @keepcv/render@0.2.2

## 0.2.0

### Minor Changes

- 9f5deba: Add a conversational home and contextual assistant with configurable model routes,
  reviewable resource changes, bounded edit permissions and native hosted research.
  Retain conversations, receipts and original PDF, image and UTF-8 attachments in
  native backups. Existing editing and export remain usable without a model service.

### Patch Changes

- Updated dependencies [9f5deba]
- Updated dependencies [9f5deba]
- Updated dependencies [9f5deba]
  - @keepcv/agent@0.2.0
  - @keepcv/core@0.4.0
  - @keepcv/api@0.5.0
  - @keepcv/schema@0.3.0
  - @keepcv/db@0.4.0
  - @keepcv/interop@0.1.7
  - @keepcv/ats-lint@0.1.5
  - @keepcv/render@0.2.1

## 0.1.8

### Patch Changes

- Updated dependencies [ce781cd]
- Updated dependencies [ce781cd]
  - @keepcv/schema@0.2.0
  - @keepcv/api@0.4.0
  - @keepcv/render@0.2.0
  - @keepcv/core@0.3.0
  - @keepcv/ats-lint@0.1.4
  - @keepcv/db@0.3.1
  - @keepcv/interop@0.1.6

## 0.1.7

### Patch Changes

- Updated dependencies [11a9291]
- Updated dependencies [11a9291]
  - @keepcv/db@0.3.0
  - @keepcv/core@0.2.0
  - @keepcv/api@0.3.0
  - @keepcv/interop@0.1.5

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
