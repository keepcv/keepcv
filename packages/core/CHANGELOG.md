# @keepcv/core

## 0.1.1

### Patch Changes

- Publish the complete package set with matching internal dependencies after the partial 0.1.0 publication. Validate all existing registry versions against the reviewed tarballs before publication, and wait for registry propagation after each publish.
- Updated dependencies
  - @keepcv/schema@0.1.1

## 0.1.0

### Minor Changes

- 9b4555f: Add the domain layer: `compile()` and the presenter per record kind that give
  every entry the same slots, the selectors screens read a cached store through,
  `composition()`, `search()` and `overview()`, fractional sort keys, `paginate`
  and `lengthBudget`, and `captureManifest` with `renderManifest`. It performs no
  I/O, so it runs unchanged in Node and in the browser.

### Patch Changes

- Updated dependencies [d47dc1b]
- Updated dependencies [9b4555f]
  - @keepcv/schema@0.1.0
