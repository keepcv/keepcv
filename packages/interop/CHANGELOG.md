# @keepcv/interop

## 0.1.0

### Minor Changes

- 9b4555f: Add the adapters for the formats other tools speak. `fromJsonResume`,
  `fromReactiveResume` and `fromRenderCv` read one in and answer an `Intake`;
  `toJsonResume`, `toDocx`, `toLatex` and `toTypst` write one out; and
  `lossOf(document, target)` counts what a given format would drop from this
  resume. The three typeset writers share one `toBlocks` seam, so a fourth adds
  a file rather than a second idea of what a resume is.

### Patch Changes

- Updated dependencies [9b4555f]
- Updated dependencies [d47dc1b]
- Updated dependencies [9b4555f]
  - @keepcv/core@0.1.0
  - @keepcv/schema@0.1.0
