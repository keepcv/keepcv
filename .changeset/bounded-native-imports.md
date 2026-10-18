---
"@keepcv/db": patch
---

Bound every native archive INSERT by the emitted parameter budget for server
PostgreSQL and PGlite, including PGlite's lower effective protocol ceiling.
Large archives import atomically without dropping historical Revisions or
changing native ids, canonical phrasings, current Revision pointers or the
empty-store policy.
