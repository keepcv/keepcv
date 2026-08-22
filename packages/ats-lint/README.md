# @keepcv/ats-lint

Reads a resume the way a machine would, and reports what it loses.

```ts
import { lint } from "@keepcv/ats-lint";
import { renderHtml } from "@keepcv/render";

const report = lint({ document, html: renderHtml(document) });
// { tier: "readable", findings: [{ rule, severity, where, detail }] }
```

Both inputs, because half the checks are about what the resume says and half
are about what the template did with it. Taking the file rather than producing
it means the thing being linted is the thing being sent.

## What it checks

| Rule | Reads | Looks for |
|---|---|---|
| `contact-extractable` | the document | a missing email address, one with no `@`, and a link whose address appears nowhere in the text beside it |
| `section-headings` | the document | a heading no system is built to look for |
| `date-format` | the document | a field marked as a date with no four-digit year, or a numeric date that reads differently either side of the Atlantic |
| `reading-order` | the file | columns, floats, coordinates, reversed or reordered boxes, and layout tables |
| `text-as-image` | the file | images, painted backgrounds, drawn shapes, and words that exist only in the stylesheet |

Dates are checked on record fields and not on an entry's period, because a
period's text is formatted by the compiler and always carries its year. A field
is whatever the user typed.

The file rules are static: they read what the template declared, not what a
browser painted. They name constructs that move the words every time, and the
answer to one is a different template rather than a different resume.

## Tiers

`tier` is derived from the findings and asserted nowhere: `clean` with none,
`readable` with warnings, `at-risk` with anything that breaks. This product
makes no claim of compatibility with any named commercial system, and nothing
here should be read as one.

## Adding a rule

Add an id to `LINT_RULES`, then a `LintRule` to `DOCUMENT_RULES` or
`OUTPUT_RULES`. `lint` stamps the id onto every issue the rule returns. A rule
that would fire on the file `ats-single-column` writes is a rule that would fire
on every resume this product produces, and the test suite says so.
