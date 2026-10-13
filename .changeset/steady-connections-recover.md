---
"@keepcv/db": patch
---

Handle idle PostgreSQL pool errors without unhandled process errors or raw diagnostics. Keep checked-out disconnects within the store lifecycle, dispose of refused connections, and let later operations reconnect without replaying ambiguous transactions.
