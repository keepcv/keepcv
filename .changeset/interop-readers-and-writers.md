---
"@keepcv/interop": minor
---

Add the adapters for the formats other tools speak. `fromJsonResume`,
`fromReactiveResume` and `fromRenderCv` read one in and answer an `Intake`;
`toJsonResume`, `toDocx`, `toLatex` and `toTypst` write one out; and
`lossOf(document, target)` counts what a given format would drop from this
resume. The three typeset writers share one `toBlocks` seam, so a fourth adds
a file rather than a second idea of what a resume is.
