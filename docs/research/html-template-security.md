# Security review for authored templates

Reviewed 2026-10-25. This supplements the
[template-type research](template-types-and-html.md) and supplies requirements
for the [implementation plan](../plans/template-types-and-html.md). This is a
design review and bounded prototype investigation, not a production security
certification. Implementation now uses a bounded capability-free binding
interpreter, not the general LiquidJS prototype. See the updated plan for the
implemented limits and residual browser-layout risks. The general-engine
isolation requirements below describe the rejected runtime candidate; they
remain relevant to future engines that can execute host code.

## What needs protection

Treat imported template source, imported career text, asset files and archived
definitions as untrusted input. A person importing a template should not have
to trust its author with their browser session, unselected career history or
machine. A system template's ownership does not grant it extra data access.

| Asset | Relevant threat |
| --- | --- |
| Session token/cookie and connected store | Script injection, parent-window access, forged requests or navigation |
| Evidence, drafts, hidden contacts and unselected wording | An overly broad render scope, logs or error dumps |
| Selected resume data | Automatic network requests, URL/CSS exfiltration or accidentally packaged preview data |
| Browser and launcher availability | Expensive parsing, loops, filters, output growth, image decoding or CSS layout |
| Host filesystem and credentials | Template file loaders, process globals or a future compiler escape |
| Other owners | Cross-owner source lookup, shared mutable engine state or incorrectly keyed render caches |
| Saved source and version history | Silent sanitation, lossy import, destructive conversion or stale-result export |
| Recipient opening exported HTML | Content that becomes active outside the preview's iframe |

The safety policy must protect these boundaries while permitting creative
layout. Multiple columns, rotated decoration and large type are not equivalent
to scripts, filesystem access or automatic external requests.

## Engine selection needs a security gate

The LiquidJS advisory history includes a code-execution report for versions
through 10.25.7 and a partial-render option-propagation report for that range.
This matters even when application code never registers an explicit JavaScript
execution helper. Review the selected release and its registry/property-lookup
behavior; do not infer safety from the language's declarative appearance.
[Code-execution advisory](https://github.com/harttle/liquidjs/security/advisories/GHSA-gf2q-c269-pqgc),
[partial-context advisory](https://github.com/harttle/liquidjs/security/advisories/GHSA-9x9p-qf8f-mvjg).

The upstream `join` advisory describes allocation accounting problems for
versions through 10.27.1; the empty-loop advisory describes a time-limit bypass
through 10.25.7. These reports justify regression cases for empty bodies,
expanding collections and large filter output, rather than testing only loops
that emit text. They do not establish that the research version is affected.
[Allocation advisory](https://github.com/harttle/liquidjs/security/advisories/GHSA-4r6h-5v86-94p3),
[empty-loop advisory](https://github.com/harttle/liquidjs/security/advisories/GHSA-8xx9-69p8-7jp3).

The prototype uses 10.30.0, outside those published affected ranges. Inspection
found own-property filter/tag registries and propagation of the property policy
into partial contexts in that installed build. Small probes are evidence about
those paths, not a claim that all advisories are resolved. Some advisory pages
list no patched version; the production choice therefore requires checking
release changes and behavior, not inventing a safe minimum from page metadata.

Recommendation: retain Liquid as a candidate, conditional on a reviewed version,
a small positive allowlist of tags/filters, a no-I/O data scope and isolated
execution. Do not ship the entire default language solely because the current
examples render successfully. In particular, reject introspection, inherited
registry names, raw-output filters and arbitrary custom helpers. If the gate
cannot be met, evaluate the smaller binding alternatives before building the
editor around this engine.

OWASP's template-injection guidance supports separating data from template
source and restricting loader/member access. In this product, authored source
is intentional; the corresponding design requirement is a restricted language
over a narrow, inert scope. A point containing Liquid-looking text must remain
text, not undergo a second template evaluation.
[Template-injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Template_Injection_Prevention_Cheat_Sheet.html).

## Execution isolation has limits

Node explicitly says `node:vm` is not a security mechanism. Node worker resource
limits apply to the JS engine and exclude external data such as ArrayBuffers;
process-wide exhaustion can still abort the process. A worker is useful for
cancellation, but is not an OS permission boundary or a complete memory limit.
[Node vm](https://nodejs.org/api/vm.html),
[Node worker limits](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html).

Consequently a Node plan using the general engine needs an isolated render process with a parent-owned
deadline, narrow message protocol, closed environment, no application credentials
or store handles, and enforceable filesystem/network/resource restrictions for
the supported host. A normal child process under the same user is not by itself
such a sandbox. The runner must advertise its actual protections and fail
closed when required isolation is unavailable. Do not silently render in the
API process as a fallback.

Browser workers also do not inherently remove network or storage APIs. Use a
host-owned static worker entry with no imported source execution, a network
policy and only the selected JSON payload. A page's `worker-src` governs worker
loading, not every operation subsequently available inside the worker. Test the
actual packaged worker policy; do not use a blob worker as an assumed sandbox.
[Worker loading policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/worker-src).

## Markup, CSS and resource policy

Escaping career text, validating URL protocols and sanitizing authored HTML are
different operations. Parse to a shared representation, validate the allowed
subset, and serialize once. The preview, HTML download, print frame and history
must use the same checked result. Do not concatenate unvalidated source or
mutate markup after this step.

CSS can issue requests, trigger expensive layout and obscure content even when
scripts are disabled. Check imports, nested resource functions, font sources,
image-set alternatives, cursor URLs, inline styles and resource-bearing HTML
attributes against the bundle-only policy. A restrictive content policy is a
second boundary, not a substitute for parsing. Keep decorative positioning
inside the document frame; it must not create an overlay on the editor shell.
[HTML/CSS context guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html),
[style policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src).

DOM clobbering can use ordinary element names and ids, without a script tag.
Keep user nodes in their own document, avoid named global/property lookup, and
validate message and measurement values at the parent boundary. Namespace
author-provided ids and fragment links consistently; do not rewrite opaque
`data-key` values into application identities.
[DOM clobbering guidance](https://cheatsheetseries.owasp.org/cheatsheets/DOM_Clobbering_Prevention_Cheat_Sheet.html).

The script-free iframe remains a useful browser boundary. The export itself
must also be safe to open outside that iframe. Embedded resource data URLs need
MIME/content checks and narrowly allowed destinations; a `data:text/html` link
is not an image asset. Keep preview links inert and reject automatic navigation,
prefetch, tracking pings, forms and refresh directives. A permitted hyperlink
can still lead to an untrustworthy site after an explicit click; do not promise
that HTML sanitation certifies a destination.

## Bundle handling, storage and privacy

OWASP recommends layered upload validation rather than trusting a filename or
claimed Content-Type. Apply that to every decoded bundle member, including
image dimensions and font/file size. Canonical paths need platform-aware checks
for traversal, aliases and special names before a future renderer materializes
files. Initial HTML rendering should never materialize bundle members on disk.
[File validation guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

Use own-property maps or null-prototype dictionaries for filenames, helpers and
settings. Reject reserved object keys and do not merge untrusted JSON into
configuration objects. Enforce byte counts after decoding and before expensive
parsing, plus output/DOM/layout budgets after rendering. Queue and concurrency
bounds matter as well as the budget for one job.

Template downloads contain source and author-provided assets only; the selected
preview resume is a separate artifact. Do not promise that a template author
cannot hard-code personal text in source. Label this distinction before sharing
and provide source/asset inspection. Never silently upload template source,
resume data or diagnostics to a third party.

Scope recovery records and caches by connection and owner; use the definition
digest, type/version, policy version, effective settings and document hash for
render identity. An interrupted or obsolete render must not overwrite a newer
preview. Clear sensitive worker messages and revoke temporary URLs after use.
Errors identify source files/lines without dumping the full scope, filesystem
paths, environment or credentials.

## Document safety and future compilers

Creative samples should retain selectable text, logical DOM order, adequate
contrast and readable contact details. Warn about clipped or hidden text and
missing document keys without deleting source or changing selection. Disable
animation in preview/print by host policy; the first type targets static
documents. ATS advice stays separate from technical validation.

LaTeX needs the same input/privacy guarantees plus its own compiler isolation,
escaping, read/write restrictions, pinned dependency bundle and shell/network
policy. Treat `.cls` and `.sty` as executable typesetting input, not harmless
assets based on extension. The existing proposal to defer the compiler remains.

## Evidence required before implementation can ship

The plan must include a fixed hostile-input corpus, exact failure assertions,
browser tests of sandbox/CSP/navigation and parent access, and Node isolation
tests with dummy secrets outside the allowed scope. Run memory-crash and
deadline probes in a disposable constrained process, not the test runner.
Verify security behavior in the installed editor and CLI packages.

Passing a few probes or showing no network requests for benign samples is
insufficient. Conversely, technical validation must still accept Studio's
poster decoration and Signal's rotated multi-region panels; the test suite
must prove creative CSS survives the policy while active content does not.

## Bounded follow-up results

The initial bounded research probes passed against the pinned 10.30.0 installation: inherited data was refused in a
partial and a collection filter; ordinary own-field filtering still worked;
an inherited `valueOf` filter name was refused; filter/tag dictionaries had null
prototypes; and a per-render property restriction survived the partial boundary.
Inserted Liquid-looking text remained text. Authored scripts and unsafe URL
schemes still survived the language layer, as expected without a markup policy.

Browser inspection of the revised Studio and Signal samples found four
sections, six entries and three points in each, without horizontal paper
overflow, script elements or external resource requests. Signal's section
transforms were present in computed styles. These benign-output checks and
small lookup probes do not validate a production sandbox, hostile CSS handling
or a crash-resistant renderer. The implementation adds separate hostile-input
regressions in the actual renderer tests.

## Implementation follow-up

The HTML parser is [hast-util-from-html](https://github.com/syntax-tree/hast-util-from-html),
which uses parse5 and supports fragment parsing. Normalized HAST is checked
against the application's passive-element policy and serialized with
hast-util-to-html. Parsing is not itself sanitation. CSS is parsed, walked and
serialized with [CSS Tree](https://github.com/csstree/csstree); URL tokens and
unsupported resource functions also pass the existing local-resource policy.
The source editor uses [CodeMirror](https://codemirror.net/examples/autocompletion/)
with HTML/Liquid and CSS language support. Its syntax highlighting does not
expand the supported binding grammar.

The custom interpreter has no eval/Function, imported executable helpers or
filesystem/network loader. Its fixed tags and filters operate over cloned
schema-validated selected data. Work accounting covers empty loops, collection
filters and string transformations. Browser workers terminate timed-out or stale
jobs, but are described only as cancellation boundaries. The finite Node path
does not claim OS sandboxing. Static asset/CSS limits reduce decoder/layout
exposure without claiming a complete browser memory limit.
