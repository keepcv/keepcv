---
"@keepcv/templates": minor
---

Add the template contract and the designs built on it. A template is data:
`fromSpec` over a `TemplateSpec`, with `FIT_KNOBS` naming what a resume may
move and `DESIGN_KNOBS` what it may not, and settings declared as `fields` the
caller renders. A template reaches nothing - it is handed a `ResumeDocument`
and its own configuration, and answers markup and the stylesheet for it.
