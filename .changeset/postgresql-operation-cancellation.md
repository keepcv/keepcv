---
"@keepcv/core": minor
"@keepcv/db": minor
"@keepcv/api": minor
---

Accept an optional cancellation signal on UnitOfWork.run and forward incoming
Request signals from API content transactions. Server PostgreSQL cancels queued
acquisition and active backend work, refuses late statements, and cleans up
without replaying callbacks. Preserve operation errors through rollback failure
and distinguish confirmed commits from ambiguous disconnects. PGlite checks
cancellation at transaction and callback boundaries; lifecycle work keeps its
independent defaults.
