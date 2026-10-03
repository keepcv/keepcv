# @keepcv/schema

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
