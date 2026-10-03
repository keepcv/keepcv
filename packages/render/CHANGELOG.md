# @keepcv/render

## 0.1.1

### Patch Changes

- Publish the complete package set with matching internal dependencies after the partial 0.1.0 publication. Validate all existing registry versions against the reviewed tarballs before publication, and wait for registry propagation after each publish.
- Updated dependencies
  - @keepcv/schema@0.1.1
  - @keepcv/templates@0.1.1

## 0.1.0

### Minor Changes

- 9b4555f: Add `renderHtml` and `renderSite`: one self-contained HTML document with the
  template's stylesheet inlined and nothing to fetch when it opens, and the
  portfolio site over that same document. The stylesheet already carries `@page`,
  physical units and break rules, so printing the file is the PDF export.
  `fileNameFor` names the file it produces.

### Patch Changes

- Updated dependencies [d47dc1b]
- Updated dependencies [9b4555f]
- Updated dependencies [9b4555f]
  - @keepcv/schema@0.1.0
  - @keepcv/templates@0.1.0
