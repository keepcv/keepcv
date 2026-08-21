# @keepcv/templates

Resume templates for [KeepCV](https://github.com/keepcv/keepcv), and the
contract every one of them binds to.

A template is handed two things - a `ResumeDocument` and its own configuration -
and returns markup and the stylesheet for it. It has no other way to reach the
world: no fetching, no store access, no ambient CSS. That is what makes a
template something a stranger can write and something the app can render inside
a document of its own.

> **Status: early development.** The public API is unstable and there is no
> release yet.

## Installation

```sh
pnpm add @keepcv/templates
```

## Usage

```tsx
import { configFor, resolveTemplate, TEMPLATES } from "@keepcv/templates";

// A document names the template it was composed for. An id this build does not
// have falls back rather than refusing to render.
const { template, config } = resolveTemplate(document);

<style>{template.styles(config)}</style>;
template.render(document, config);
```

### Configuration

A template declares its settings as `fields`, and the Zod-free validator
`configFor` is the one way a stored configuration becomes a usable one:

```ts
configFor(template, { fontSize: 12, retiredLastYear: "x" });
// every declared key, `fontSize` at 12, unknown keys dropped
```

A key the template no longer declares is ignored, one it has added takes its
default, and a value outside the declared range is refused rather than rendered.
That matters because a configuration outlives the template version that wrote
it - it is stored on the resume and pinned into every version captured since.

Rendering a settings panel is reading `template.fields`, so a template that adds
a setting needs no change in the app.

## What "is a template" means

`isATemplate` in `conformance.harness.ts` is the suite, and `FIXTURE_DOCUMENT`
is what it runs over: every slot, every field kind, all three inline marks, all
three layouts, a section with nothing under it, an entry with no points, a point
with no metrics, an entry no group claims, and an entry of a kind no presenter
in this build emits.

A template passes when it

- prints every section, entry and point exactly once, each tagged with the
  document's own `data-key`, so a rendered element maps back to what produced it
- names an empty section rather than dropping the heading - silently losing a
  section is the destructive behaviour this product exists to eliminate
- renders an entry whose kind it has never heard of
- links only to addresses the document carries, and ships a stylesheet that
  fetches nothing
- renders at both ends of every value it offers

## Templates

### `ats-single-column`

One column in reading order, no tables and no text inside images. Every contact
prints its own value and every field prints `label: value`, so both survive
being read as plain text. Page size, typeface, body size, line height, margin,
section spacing and heading case are configurable.

Its `complianceNotes` are observations about what it does, never claims about
what any named product accepts.

## Licence

MIT - see [LICENSE](LICENSE).
