# @keepcv/schema

Zod definitions for every shape shared across [KeepCV](https://github.com/keepcv/keepcv).

This package is the single source of truth for the wire format, the file
format and the published JSON Schema. TypeScript types, API validation and
form validation all derive from these definitions rather than restating them.

It depends on nothing but Zod, and must never gain another dependency - it is
imported by every other package, including ones that run in the browser.

> **Status: early development.** The public API is unstable and there is no
> release yet.

## Installation

```sh
pnpm add @keepcv/schema
```

## Usage

```ts
import { partialDateSchema, richTextSchema } from "@keepcv/schema";

const startedOn = partialDateSchema.parse("2019-03");

const body = richTextSchema.parse([
  { t: "text", v: "Cut p95 latency to " },
  { t: "b", c: [{ t: "text", v: "180ms" }] },
]);
```

Schemas are branded, so a `PartialDate` cannot be passed where a plain `string`
is expected and vice versa. Parsing is the only way to obtain one.

## The export document

`exportDocumentSchema` describes KeepCV's canonical, lossless career store
format - the store, not a resume. Reading one always goes through
`migrateDocument`, which brings an older `schemaVersion` forward before
validating, so a document exported years ago still loads.

```ts
import { migrateDocument, UnsupportedSchemaVersionError } from "@keepcv/schema";

const store = migrateDocument(JSON.parse(contents));
```

A version newer than the running build, or an older one with no migration path,
throws `UnsupportedSchemaVersionError`. A malformed document at a version we do
understand throws a `ZodError` instead, so the two are distinguishable.

The JSON Schema for the format is emitted from the Zod definition and committed
at [`schema/keepcv-v1.schema.json`](schema/keepcv-v1.schema.json), so a KeepCV
export can be validated without running KeepCV. Regenerate it after any schema
change - a test fails when the committed copy has drifted:

```sh
pnpm --filter @keepcv/schema schema:emit
```

## Licence

MIT - see [LICENSE](LICENSE).
