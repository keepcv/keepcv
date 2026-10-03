# keepcv

## 0.1.1

### Patch Changes

- Publish the complete package set with matching internal dependencies after the partial 0.1.0 publication. Validate all existing registry versions against the reviewed tarballs before publication, and wait for registry propagation after each publish.
- Updated dependencies
  - @keepcv/api@0.1.1
  - @keepcv/ats-lint@0.1.1
  - @keepcv/core@0.1.1
  - @keepcv/db@0.1.1
  - @keepcv/interop@0.1.1
  - @keepcv/render@0.1.1
  - @keepcv/schema@0.1.1

## 0.1.0

### Minor Changes

- 9b4555f: Add the launcher. `serve` opens the store, runs pending migrations and serves
  the API and the web app on one origin, with the launch token in the URL
  fragment; `render`, `status`, `backup`, `restore` and `set-password` round it
  out. `--auth token`, `--auth password` and `--auth proxy` all answer one owner,
  and binding off loopback refuses `token`. The built web app ships inside the
  package, so an install carries its own interface. Requires Node 24 or newer.

### Patch Changes

- Updated dependencies [9b4555f]
- Updated dependencies [9b4555f]
- Updated dependencies [9b4555f]
- Updated dependencies [d47dc1b]
- Updated dependencies [9b4555f]
- Updated dependencies [9b4555f]
- Updated dependencies [9b4555f]
- Updated dependencies [9b4555f]
  - @keepcv/api@0.1.0
  - @keepcv/ats-lint@0.1.0
  - @keepcv/core@0.1.0
  - @keepcv/schema@0.1.0
  - @keepcv/db@0.1.0
  - @keepcv/interop@0.1.0
  - @keepcv/render@0.1.0
