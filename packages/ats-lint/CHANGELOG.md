# @keepcv/ats-lint

## 0.1.1

### Patch Changes

- Publish the complete package set with matching internal dependencies after the partial 0.1.0 publication. Validate all existing registry versions against the reviewed tarballs before publication, and wait for registry propagation after each publish.
- Updated dependencies
  - @keepcv/schema@0.1.1

## 0.1.0

### Minor Changes

- 9b4555f: Add `lint({ document, html })`, which reads a resume the way an applicant
  tracking system would and answers a tier with per-rule findings. It takes the
  rendered bytes rather than producing them, so the thing linted is the thing
  sent.

### Patch Changes

- Updated dependencies [d47dc1b]
- Updated dependencies [9b4555f]
  - @keepcv/schema@0.1.0
