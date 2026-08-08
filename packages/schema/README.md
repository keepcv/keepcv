# @keepcv/schema

Zod definitions for every shape shared across [KeepCV](https://github.com/keepcv/keepcv).

This package is the single source of truth for the wire format, the file
format and the published JSON Schema. TypeScript types, API validation and
form validation all derive from these definitions rather than restating them.

It depends on nothing but Zod, and must never gain another dependency — it is
imported by every other package, including ones that run in the browser.

> **Status: early development.** The public API is unstable and there is no
> release yet.

## Installation

```sh
pnpm add @keepcv/schema
```

## Usage

```ts
import { sortKeySchema, type SortKey } from "@keepcv/schema";

const key: SortKey = sortKeySchema.parse("a0V");
```

Schemas are branded, so a `SortKey` cannot be passed where a plain `string` is
expected and vice versa. Parsing is the only way to obtain one.

## Licence

MIT — see [LICENSE](LICENSE).
