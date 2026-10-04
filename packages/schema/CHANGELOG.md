# @keepcv/schema

## 0.1.2

### Patch Changes

- Publish the complete package set under the @keepcv organization, with the launcher named @keepcv/cli and its executable still named keepcv. Use fresh matching internal versions after the library-only 0.1.1 publication.

## 0.1.1

### Patch Changes

- Publish the complete package set with matching internal dependencies after the partial 0.1.0 publication. Validate all existing registry versions against the reviewed tarballs before publication, and wait for registry propagation after each publish.

## 0.1.0

### Minor Changes

- d47dc1b: Add the shared primitive vocabulary (`uuid`, `timestamp`, `partialDate`,
  `contentHash`, `richText`), the versioned export document with its forward
  migration registry, and the JSON Schema emitted from it.
- 9b4555f: Add the DTOs the rest of the store is written against: the profile, contact
  channels, organisations, records and their kind-specific fields, points,
  phrasings, tags, custom sections, role profiles, templates, resumes and their
  history. `ResumeDocument` is here too - the one shape that crosses every layer
  unchanged - alongside the `Intake` union a reader answers.
