---
"@keepcv/agent": patch
"@keepcv/core": minor
"@keepcv/api": patch
"@keepcv/editor": patch
---

Bound process-local proposal, grant and revocation state. Reclaim committed
admissions, expire pending review authority and grants, and retire a runtime
instead of forgetting revoked scopes at capacity. Make close terminal while
preserving durable receipt replay in a fresh authorized runtime.

Report Stop against an unowned running lease as 409 with expiry guidance. Local
cancellation never clears another process's lease or reverses committed changes;
the editor displays that guidance without claiming completion.
