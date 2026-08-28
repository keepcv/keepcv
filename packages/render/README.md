# @keepcv/render

Turns a `ResumeDocument` into a file someone can send.

```ts
import { fileNameFor, renderHtml } from "@keepcv/render";

const html = renderHtml(document);        // one self-contained HTML document
const name = fileNameFor(document, "html");  // "ada-lovelace-staff-engineer.html"
```

`renderHtml` resolves the template the document names, inlines that template's
stylesheet, and returns markup that fetches nothing when it is opened. The
stylesheet already carries `@page`, physical units and break rules, so printing
the file is the PDF export: the browser's own print engine paginates it, which
is the same engine the preview measures.

There is no PDF writer here and no headless browser. See
[`docs/architecture/application-structure.md`](../../docs/architecture/application-structure.md)
for why.

## The same selection as a page

```ts
import { renderSite, SITE_FILE_NAME } from "@keepcv/render";

const page = renderSite(document);   // one self-contained HTML page
SITE_FILE_NAME;                      // "index.html"
```

The second renderer over the same document: a header, one card per entry, a jump
list between sections, system fonts, and a light and a dark scheme. It fetches
nothing either, and it takes no configuration - a template is configured because
a resume has to fit a page, and a page has no page to fit.

It carries the contact details the resume carries. What a stranger sees is
decided when the resume is composed, not here.

`@keepcv/core` compiles the document; this package only renders one, so it runs
in Node and in the browser alike.
