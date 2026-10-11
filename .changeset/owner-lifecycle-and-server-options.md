---
"@keepcv/db": minor
---

Add atomic, retry-safe owner provisioning and explicitly confirmed owner
erasure outside the editing repositories. Preserve filled profiles on retries
and recover from interrupted provisioning. Expose connection limits, connection
and idle timeouts, statement timeouts and validated TLS CA configuration.
Validate the configured TLS hostname for IP connections and prevent URL SSL
parameters from overwriting that check.
Run migration locking and migration SQL on the same connection, including
single-connection pools, and make shutdown safe to await more than once.
