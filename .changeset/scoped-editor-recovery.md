---
"@keepcv/editor": minor
---

Add an optional `recoveryNamespace` to `Editor` so pending wording, template
designs and resume settings stay with the connected store when imported ids
overlap. Failed saves and sign-out preserve recovery for each namespace.
Omitting it retains standalone recovery, including existing unscoped edits;
scoped connections leave those legacy copies untouched.
