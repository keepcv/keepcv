# @keepcv/core

Domain logic and invariants for [KeepCV](https://github.com/keepcv/keepcv).

This package performs **no I/O** — no filesystem, no network, no database
driver, no Node built-ins. It runs unchanged in Node and in the browser, which
is what lets the resume preview compile client-side from cached data while the
server compiles the same document for export.

That is enforced rather than encouraged: the package builds with `"types": []`
and no DOM library, so a `node:*` import or a reference to `process` is a
compile error.

> **Status: early development.** The public API is unstable and there is no
> release yet.

## Installation

```sh
pnpm add @keepcv/core
```

## Usage

Ordering is fractional rather than positional, so moving an item writes one
row instead of renumbering everything after it:

```ts
import { generateKeyBetween } from "@keepcv/core";

const first = generateKeyBetween(null, null); // "a0"
const second = generateKeyBetween(first, null); // "a1"
const between = generateKeyBetween(first, second); // "a0V"
```

Pass `null` for either bound to insert at the start or end of a list.

### Identifiers

Identifiers are UUIDv7 and are minted on whichever side is doing the work,
usually the client — so a row has its identity before the server has heard of
it and an optimistic write is the real write.

```ts
import { newUuid } from "@keepcv/core";

const pointId = newUuid(); // "019fe174-f9f9-7099-a4ab-4e88bdf91f79"
```

Identifiers from one process increase strictly, including within a single
millisecond, so they order the same way in an index as in time.

### Phrasing text

Phrasing bodies are a restricted inline AST. `canonicaliseRichText` puts one
into the form it is stored and hashed in, and `contentHash` is SHA-256 over its
canonical JSON encoding:

```ts
import { canonicaliseRichText, contentHash, projectPlainText } from "@keepcv/core";

const body = canonicaliseRichText([
  { t: "text", v: "Cut p95 latency to " },
  { t: "b", c: [{ t: "text", v: "180" }] },
  { t: "b", c: [{ t: "text", v: "ms" }] },
]);
// the two bold runs are now one

projectPlainText(body); // "Cut p95 latency to 180ms"
contentHash(body); // "a712871a…"
```

**Store the canonical body, not the one you were handed.** Bodies that render
identically canonicalise to the same tree and therefore hash the same, which is
what makes "no revision unless the text actually changed" a database guarantee
rather than a convention. Hashing a canonical body and storing a raw one makes
the stored hash unverifiable on read.

`contentHash` accepts any JSON value, so resume version manifests hash through
the same encoding.

## Licence

MIT — see [LICENSE](LICENSE).
