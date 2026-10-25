# Template types and HTML authoring

Implementation plan, updated 2026-10-25. The visual-builder overhaul is the
starting point. Research and the security review preceded implementation.

## Outcome and boundaries

KeepCV offers Default (visual) and HTML templates. A template belongs either to
the system or to its creator. System designs are read-only; Make a copy creates
an owned editable definition of the same type. Existing system ids keep their
original design. User edits never rewrite a captured version.

The felt pain is limited creative freedom and an undocumented source format.
The HTML workspace provides code editing, local files, data discovery, preview,
explicit save, draft recovery, undo, source import/export and reusable designs.
The Default builder retains its visual controls. Resume Content selects data;
Design chooses the template and fit. PDF stays in the resume header, with other
formats in a dialog.

Non-goals: JavaScript templates, remote dependencies, a template marketplace,
a career-media store, a LaTeX compiler or a universal ATS guarantee. LaTeX is a
future type with its own payload, validation and compiler isolation requirements.

## Contract and extension

`template.spec` remains the single stored definition. New writes use
`{ type: string, version: number, payload: Record<string, unknown> }`.
No separate type column repeats the same fact. Existing `{ settings, extraCss }`
definitions remain readable as Default v1, including in old manifests.

The schema package validates bounded JSON. Installed trusted `TemplateType`
handlers validate their payload and optionally provide an HTML renderer.
`validateTemplate`, `fromDefinition`, `resolveTemplate`, `renderHtml` and
`createApi` accept a caller-supplied type catalog. A handler is application code,
never executable code loaded from an imported template. No central type enum
must be widened to install one. The built-in editor authors Default and HTML;
other handlers need their own authoring interface.

Unknown types/versions survive native archive import and source downloads.
Ordinary template writes refuse unavailable types. The library remains usable,
shows the type and preserves its source. A resume using an unavailable handler
can change template; rendering does not silently substitute Default for a typed
definition. The legacy missing-system-id fallback is retained for compatibility.

The existing JSONB column stores the envelope, so no SQL migration is needed.
Native archive v2 declares the expanded format. The v1 migration changes only
the archive envelope: embedded documents, manifests and hashes are untouched.
A template's whole source bundle is pinned by existing manifest capture.

## HTML source bundle

The payload contains `documentVersions`, `entry`, ordered `styles`, `files` and
`page: { size: "a4" | "letter", marginMm: number }`. Each file has `mediaType`,
`encoding: "utf8" | "base64"` and `content`. HTML files are fragments; the app
owns the document shell, content policy and print page settings. CSS is static.

Files are canonical bundle members, never host filesystem paths. Partials use
literal member names with explicit arguments. Images and fonts use member names
in HTML/CSS and are rewritten to validated self-contained data URLs. Renaming
updates the entry and stylesheet list; the workspace tells authors to update
source references. Missing references report errors instead of being fetched.

Initial bounds: 64 files, 512 KiB UTF-8 source, 1 MiB decoded assets, canonical
case-unique paths, no traversal or reserved object/Windows names. Assets are
static PNG/JPEG/WebP and WOFF2, checked by signature and dimensions/header bounds.
Images are limited to 4096 per axis and four megapixels across the bundle; fonts declare at most
8 MiB expanded size. Animated image formats, SVG, arbitrary data URLs and remote
resources are unavailable. Source and assets travel in backups and history;
these conservative bounds also limit growth of the cached store.

## Selected-data interface

`templateDataSchema` derives its resume shape from `ResumeDocument`, narrowing
metadata to generatedAt, resumeName and locale. `htmlScope` validates and clones
this JSON-only shape. It contains no store, evidence, drafts, hidden/unselected
content, source, auth state, API client or host object. There is one compiler:
this interface projects the already compiled selection rather than selecting or
formatting content again.

| Binding | Meaning |
| --- | --- |
| resume.header | Selected name, headline, summary and contact channels |
| resume.sections | Visible ordered sections and their resolved headings |
| section.entries | Uniform presentation of selected records |
| entry.points | Visible points with resolved wording, metrics and tags |
| entry.fields / entry.links | Labelled values and selected links |
| entry.period | Partial dates and formatted display |
| section.groups / group.entryKeys | Group membership referencing entry keys |
| Arrays / forloop.index | Composition order and current loop order |
| page.size / page.marginMm | Effective page configuration |

The builder's Resume data view searches fields generated from this same schema,
including optional/empty fields. It shows current sample values, JSON and
copy/insert bindings. Indexed paths demonstrate one item; authors use loops to
render complete lists. The builder previews sample, coverage or live selected
resume data. Template data is also discoverable from the resume Design controls
and the template chooser used during resume creation.

## Binding language and security decision

The research prototype used LiquidJS. Advisory review and isolation analysis
showed that a general JavaScript-hosted engine would require an additional
permission boundary. Node workers, vm and ordinary child processes do not supply
one. The implementation instead uses a small capability-free interpreter with
Liquid-like syntax. It does not load LiquidJS, evaluate JavaScript, call functions
from data or expose a host loader. This is a deliberate correction to the first
engine plan, recorded before integration.

Supported syntax: escaped `{{ value }}`, field paths and indexed sample paths,
assign, if/unless/elsif/else, for/else, literal local render and rich_text.
Conditions support comparisons, contains, and/or. Fixed filters are default,
join, where, first, last, size, upcase, downcase, capitalize, slice and in_group.
The last selects entries using group.entryKeys. Dynamic includes, ranges,
prototype/runtime properties, raw HTML and arbitrary helpers are refused.

Data is substituted once. Rich text validates the existing AST and uses the
shared formatter. Missing fields report a source location unless guarded by if
or default. Each partial receives resume/page and explicit arguments. Variables
cannot replace reserved scope roots.

The interpreter limits expressions, tokens, nesting, partial depth, operations,
string work and output before concatenation. Initial limits are 10,000 tokens
per file, nesting/partial depth 16, 100,000 work units, 2 MiB selected JSON and
5 MiB rendered HTML. Empty loop bodies and string filters consume work too.
Browser jobs run in a packaged static worker with a parent-owned 2.5 second
deadline. Obsolete jobs terminate. Workers supply cancellation, not a permission
sandbox. The same finite interpreter runs in Node without evaluating source as
JavaScript; no OS isolation claim is made.

## Markup, CSS and delivery safety

Use maintained HAST/parse5 HTML parsing and serialization, and CSS Tree parsing,
walking and serialization. Apply explicit passive HTML element/attribute lists,
protocol checks after interpolation and CSS/resource policy. The output is
checked even when a native archive contains source that bypassed ordinary save
validation. Keep authored source intact for repair; do not overwrite it with
normalized or stripped output.

Refuse script/event handlers, forms, embedded documents, SVG, metadata/navigation
elements, remote resource attributes, ping, imports, unsupported URL-producing
CSS functions, animation/transitions and author-owned @page. Prefix document ids
and matching fragment/CSS/ARIA references. CSS layout freedom includes grids,
columns, transforms and decorative positioning; these are not script access.

The preview is a separate document with sandbox="allow-same-origin" and no
allow-scripts. A restrictive CSP blocks scripts, remote images/fonts, network,
forms and base URLs. Preview links cannot navigate. Exports use the same checked
renderer and CSP; opening exported HTML does not depend on the app iframe's
protection. PDF is still that HTML handed to browser print. Alternate writers
produce their declared layouts, not a conversion of arbitrary authored CSS.

Technical validity is separate from readability. Creative CSS can affect reading
order, and checks remain advisory. Arbitrary HTML does not claim accurate flow
pagination or a fit budget. The UI tells people to inspect browser print preview.

These controls bound source, interpreter and output work. They are not a hard
browser-process memory limit or a proof against every pathological layout/font
or browser-decoder bug. Keep parser dependencies current, use hostile regression
cases and inspect large selections. A future native compiler must establish its
own filesystem/network/process protections before shipping.

## System samples

| Template | Direction |
| --- | --- |
| Studio | Graphic poster, oversized name, citrus/pink geometry, numbered strips |
| Signal | Orange portfolio contact sheet, tilted panels and circular stamp |
| Folio | Restrained serif editorial comparison |

Studio and Signal target creative professions. Career text stays selectable and
DOM order follows the composition. Decorations carry no invented career claims.
Canonical definitions live in the templates package; the example runner exports
them through the actual renderer, avoiding a second copy of sample source.

## Validation and delivery

Check schema and payload bounds, ordinary API writes, owner isolation and stale
writes; native archive source/asset round trips, unknown handlers, unchanged v1
history and pinned source. Exercise all system designs with sparse, reordered,
long and hostile data. Cover unsafe schemes/entities, attributes, resource CSS,
missing/cyclic partials, prototype names, empty loops and oversized output.

Check the builder's explicit save, invalid-source recovery, source download,
file undo, data discovery and unavailable-type state. Test worker deadline and
cancellation independently. Inspect the built editor in an isolated consumer
and the complete launcher on a throwaway store, including desktop/mobile,
preview, copy/save/apply, export and errors. Mutation-check material safety
predicates, then restore them. Run pnpm check, build and release:check, and emit
the updated published JSON Schema. No destructive database migration is involved.
