# @keepcv/api

## 0.1.1

### Patch Changes

- Publish the complete package set with matching internal dependencies after the partial 0.1.0 publication. Validate all existing registry versions against the reviewed tarballs before publication, and wait for registry propagation after each publish.
- Updated dependencies
  - @keepcv/core@0.1.1
  - @keepcv/schema@0.1.1

## 0.1.0

### Minor Changes

- 9b4555f: Add the HTTP boundary: `createApi` over the repository port, the owned
  collections and the nested routes hanging off them, the boot payload, native
  export and import, intake, resume compilation and the version timeline, RFC
  9457 `problem+json` errors, a generated OpenAPI document and a typed client.
  `createApi` takes the port, an owner scope and an `authenticate` function, and
  knows nothing about a driver or a port number.

### Patch Changes

- Updated dependencies [9b4555f]
- Updated dependencies [d47dc1b]
- Updated dependencies [9b4555f]
  - @keepcv/core@0.1.0
  - @keepcv/schema@0.1.0
