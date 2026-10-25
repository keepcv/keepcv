# Template types and authored HTML: research

Researched 2026-10-25 against the current template-builder working tree, based
on main `8e43845`. This is research for a proposed capability, not an inventory
of implemented template types at the time of the initial audit. The updated
[implementation plan](../plans/template-types-and-html.md) records the resulting
bounded binding interpreter, source policy and shipped samples; LiquidJS was
used only for the initial design studies.

The follow-up [security review](html-template-security.md) covers the threat
model, upstream advisories, process/browser isolation and hostile-input gates.
Its findings make the Liquid recommendation conditional on that security gate.

## The problem in the current implementation

The visual builder exposes a fixed style vocabulary. `fromSpec` supplies the
markup, and authors can change its settings and add local CSS. This is useful
for quick resume creation, but it cannot express an entirely different document
structure. More knobs would still leave authors working inside that structure.

The existing data boundary is useful beyond that renderer. `ResumeDocument`
already contains the selected contacts, resolved wording, ordered sections,
uniform entries, points, groups, links and custom fields. It contains no evidence
or full-store access. A new template language should consume that same document.

Current assumptions that need deliberate changes:

| Area | Current assumption | Implication |
| --- | --- | --- |
| Persistence | Every `template.spec` has `settings` and `extraCss` | A type discriminator belongs in the definition, with legacy reading |
| History | Captured user specs are embedded in manifests | Capture every file and the type/version, not a mutable template reference |
| Rendering | Every resolved template renders a React element | HTML needs an adapter; future native outputs need an explicit capability |
| Preview | The parent mounts and measures an iframe's DOM | Script-free sandboxing must preserve parent measurement |
| Page counting | A flowing column is measured | Arbitrary grids and positioned content need an honest unsupported/approximate state |
| Conformance | Built-in templates pass all ATS rules | User-authored creative layouts need a separate technical contract |
| Exports | Word and LaTeX writers consume the document | These remain content conversions; they do not reproduce authored HTML styling |

## Binding-language comparison

| Approach | Fit for this request | Decision |
| --- | --- | --- |
| HTML and CSS only | Full visual freedom, no loops or data bindings | Needs a small declarative binding language |
| LiquidJS | HTML-friendly expressions, loops, conditionals, partial files; runs synchronously or asynchronously | Recommended, with a restricted registered language and isolated rendering |
| Handlebars | Familiar HTML expressions and iteration; custom helpers would supply more selection logic | Viable alternative; less convenient for filtering and reusable data transformations |
| Nunjucks | Expressive Jinja-style authoring | Reject for imported user-authored templates under its documented security model |
| User JavaScript/JSX | Arbitrary computation and browser access | Unnecessary for HTML structure; would add an execution platform to the feature |

LiquidJS provides output escaping, strict missing-variable/filter options and
own-property lookup controls. Configure these explicitly; interpolation is not
HTML-escaped by default. Its synchronous API permits reuse in the current HTML
renderer. These are reasons to evaluate Liquid, not a claim that it provides a
security sandbox. [Options](https://liquidjs.com/tutorials/options.html),
[escaping](https://liquidjs.com/tutorials/escaping.html),
[sync and async](https://liquidjs.com/tutorials/sync-and-async.html).

LiquidJS documents cooperative parse, render and allocation limits and warns
that they are not hard CPU or memory isolation. The proposed application must
also bound input/output and isolate cancellable browser and Node execution.
The options and security pages disagree about the default of `ownPropertyOnly`;
set it to `true` explicitly and test prototype access.
[Security model](https://liquidjs.com/tutorials/security-model.html).

LiquidJS supports an in-memory file map. Its normal browser loader can resolve
URLs, so the implementation must replace file loading with bundle-only lookup.
Literal partial names and a dependency graph are preferable to dynamic includes.
The render tag isolates a partial's local scope and accepts explicit arguments.
[File loading](https://liquidjs.com/tutorials/render-file.html),
[render tag](https://liquidjs.com/tags/render.html).

Handlebars escapes ordinary expressions and provides helpers; raw expressions
and safe-string helpers require care. Nunjucks explicitly warns that it does
not sandbox user-defined templates. These documented differences support the
recommendation above. [Handlebars expressions](https://handlebarsjs.com/guide/expressions.html),
[Nunjucks API warning](https://mozilla.github.io/nunjucks/api.html).

## Authoring and data discoverability

CodeMirror has a maintained Liquid language package. Its completion extension
can provide application-defined suggestions. A code editor plus a selected-data
explorer can expose real values, types, optional fields and insertable loops
without introducing an HTTP API. LiquidJS also offers static variable analysis,
but labels that API experimental; it should supplement, not define, the public
data contract. [Liquid language package](https://github.com/codemirror/lang-liquid),
[completion](https://codemirror.net/examples/autocompletion/),
[static analysis](https://liquidjs.com/tutorials/static-analysis.html).

Recommendation: derive the explorer's field vocabulary from the shared document
schema and its values from the selected preview document. Keep authored settings
separate from resume data. Introduce readable snippets for optional text, ordered
lists, groups, URLs, metrics and custom fields.

## HTML handling and preview

HTML escaping alone does not make authored markup, URLs or CSS safe. OWASP
recommends sanitization for authored HTML and distinguishes URL, attribute, CSS
and text contexts. Use a shared parser-based HTML policy plus a CSS/resource
policy, with source diagnostics when an unsupported construct is encountered.
[HTML sanitization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).

The hast sanitizer is an allowlist-based AST utility. It is a candidate for a
shared Node/browser pipeline; its default schema is not a ready-made creative
resume policy. The production spike must verify preservation of allowed classes,
document keys, CSS and graphics, and test malformed-markup handling in a browser.
[hast sanitizer](https://github.com/syntax-tree/hast-util-sanitize).

An iframe without `allow-scripts` prevents scripts in the embedded document;
`allow-same-origin` can retain parent DOM access for measurement. Combining both
permissions would defeat this boundary for same-origin content. CSP's `sandbox`
directive cannot be supplied in a meta tag, so downloaded HTML also needs
sanitized content and a restrictive content policy.
[Iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe),
[CSP sandbox](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox).

Browser paged media supplies page size, margins and break behavior. Arbitrary
creative grids are not evidence that the current flow-based page estimator is
accurate. Preserve the browser print path and report unsupported estimates
honestly. [CSS paged media](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Paged_media).

## Future LaTeX bundles

LaTeX is a different rendering backend, not another HTML theme. Its bundle may
include an entry `.tex`, class `.cls`, style `.sty`, images and fonts. Source
substitution needs TeX-specific escaping rather than the HTML escaping policy.

Tectonic is a candidate to assess when that capability is built. Its CLI offers
untrusted mode and an option to use cached support files only. The documentation
describes network lookup for missing support files, so offline operation requires
an explicitly provisioned and pinned support bundle. These controls do not
replace process isolation or a constrained filesystem.
[Compile and security options](https://tectonic-typesetting.github.io/book/latest/v2cli/compile.html),
[cached support files](https://tectonic-typesetting.github.io/book/latest/v2cli/build.html).

Recommendation: implement the type and file-container seam now, with Default
and HTML as the only available types. Add a LaTeX handler only together with its
compiler, dependency policy, source diagnostics, preview and export behavior.
Do not add a disabled LaTeX option or assume the existing generic `.tex` writer
implements template compilation.

## Prototype and its limits

The accompanying [examples](../examples/html-templates/README.md) exercise the
proposed Liquid syntax against one schema-validated `ResumeDocument`. They
demonstrate distinct HTML structures, local partial files, selected-content
order and a host-owned rich-text tag. Their renderer is for these trusted
repository examples, not a production interpreter for imported templates.
The implementation plan specifies the remaining isolation and validation work.
Studio is now a graphic poster and Signal a portfolio contact sheet; both
explicitly explore unorthodox creative layouts. Folio remains the restrained
comparison. These remain trusted design studies, not imported-source safety
examples.

Observed prototype results with LiquidJS 10.30.0:

- All three bundles rendered from the same schema-validated sample; each
  produced four sections, six entries and three points with document keys.
- Reversing the selected section array reversed normal loop output. Empty
  header/section data rendered without an exception, and injected markup in
  the name was escaped.
- Strict lookup refused an unknown field and inherited `constructor` access.
  An absent partial failed instead of loading a file outside the in-memory map.
- A large range loop hit a deliberately small cooperative render limit.
  This did not test hard memory or CPU isolation.
- Authored script markup and a `javascript:` link survived the Liquid layer.
  This confirms that output escaping is not the required HTML/URL policy.
- Browser inspection found no horizontal overflow inside the A4 page, no
  script elements and no external resource requests in the three trusted
  rendered samples. The generated gallery was visually inspected at 1280 x 800.
- A separate browser probe with `sandbox="allow-same-origin"` allowed parent
  DOM measurement while blocking an authored script. Printing permissions and
  the full production rendering policy still require implementation validation.

The new storage cost also matters: definitions currently travel in the root
store payload and are copied into captured versions. Binary file support must
be benchmarked against those paths and browser recovery storage before fixing
budgets; this research has not validated a production asset-library scale.
