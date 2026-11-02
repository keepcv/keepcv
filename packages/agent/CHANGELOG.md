# @keepcv/agent

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
