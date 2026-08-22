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

`@keepcv/core` compiles the document; this package only renders one, so it runs
in Node and in the browser alike.
