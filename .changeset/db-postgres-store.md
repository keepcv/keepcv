---
"@keepcv/db": minor
---

Add the PostgreSQL store: the Drizzle schema for the record store, its
vocabulary, its editor state, the composition a resume is and its history; the
migrations that create them; and the repositories implementing the port. The
same schema and queries run on PGlite locally and on a server PostgreSQL, and
the contract suite runs against both. `resume_version` and `phrasing_revision`
are append-only, each held that way by a trigger.
