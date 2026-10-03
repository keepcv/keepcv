# @keepcv/db

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
