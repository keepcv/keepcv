---
"@keepcv/core": minor
---

Add the domain layer: `compile()` and the presenter per record kind that give
every entry the same slots, the selectors screens read a cached store through,
`composition()`, `search()` and `overview()`, fractional sort keys, `paginate`
and `lengthBudget`, and `captureManifest` with `renderManifest`. It performs no
I/O, so it runs unchanged in Node and in the browser.
