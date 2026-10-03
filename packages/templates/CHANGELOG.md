# @keepcv/templates

## 0.1.0

### Minor Changes

- 9b4555f: Add the template contract and the designs built on it. A template is data:
  `fromSpec` over a `TemplateSpec`, with `FIT_KNOBS` naming what a resume may
  move and `DESIGN_KNOBS` what it may not, and settings declared as `fields` the
  caller renders. A template reaches nothing - it is handed a `ResumeDocument`
  and its own configuration, and answers markup and the stylesheet for it.

### Patch Changes

- Updated dependencies [d47dc1b]
- Updated dependencies [9b4555f]
  - @keepcv/schema@0.1.0
