# @keepcv/core

Domain logic and invariants for [KeepCV](https://github.com/keepcv/keepcv).

This package performs **no I/O** — no filesystem, no network, no database
driver, no Node built-ins. It runs unchanged in Node and in the browser, which
is what lets the resume preview compile client-side from cached data while the
server compiles the same document for export.

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

## Licence

MIT — see [LICENSE](LICENSE).
