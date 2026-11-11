# @keepcv/agent

## 0.6.0

### Minor Changes

- 68202c1: Ask for sharing consent on the first send without losing the intended draft.
  Bind acknowledgment to the connected session and current processing scope.
  Support finite host containers, labeled host destinations/actions and structured
  failure recovery with server Retry-After. Advertise and enforce effective
  attachment-generation formats separately from stored originals. Export a shared
  SVG favicon and exercise installed hosted consumers.

### Patch Changes

- Updated dependencies [68202c1]
  - @keepcv/core@0.7.0
  - @keepcv/schema@0.6.0

## 0.5.0

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

## 0.4.0

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
  - @keepcv/core@0.6.0

## 0.3.0

### Minor Changes

- Show assistant tool names and their purpose directly in the chat during execution and in saved replies. Preserve this optional activity in conversation history and native archives, including interrupted replies. Existing messages and custom model adapters remain compatible.

  Clarify that adding a Point creates its phrasing set, so the model does not propose creating the same set twice.
  Identify attached text files as source material so replies can attribute their contents correctly.
  Separate narration across tool steps into paragraphs in both live and saved messages.

### Patch Changes

- Updated dependencies
  - @keepcv/schema@0.4.0
  - @keepcv/core@0.5.0

## 0.2.0

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
