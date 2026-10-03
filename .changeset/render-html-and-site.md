---
"@keepcv/render": minor
---

Add `renderHtml` and `renderSite`: one self-contained HTML document with the
template's stylesheet inlined and nothing to fetch when it opens, and the
portfolio site over that same document. The stylesheet already carries `@page`,
physical units and break rules, so printing the file is the PDF export.
`fileNameFor` names the file it produces.
