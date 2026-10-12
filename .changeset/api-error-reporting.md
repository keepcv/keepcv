---
"@keepcv/api": minor
---

Add optional `reportUnexpectedError` to `createApi` and `problemFor`. Consumers
can disable default console reporting with `null` or supply their own reporter.
Reporter failures do not change client problems or produce fallback console
output. Expected problems retain their existing behavior and are not reported.
