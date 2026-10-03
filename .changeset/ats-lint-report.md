---
"@keepcv/ats-lint": minor
---

Add `lint({ document, html })`, which reads a resume the way an applicant
tracking system would and answers a tier with per-rule findings. It takes the
rendered bytes rather than producing them, so the thing linted is the thing
sent.
