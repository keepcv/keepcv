# The Template-Facing Document Model

> The contract every renderer binds to: `ResumeDocument`.
> Companions: [`data-model.md`](data-model.md),
> [`application-structure.md`](application-structure.md).

---

## 1. What this is

`ResumeDocument` is the **only** thing a template, exporter, linter or
portfolio renderer ever sees. It is:

- **Uniform** - every entry has the same slots, whether it is a job, a degree,
  a certification or a custom row. Templates never branch on record kind
  unless they choose to.
- **Frozen and self-contained** - no store identifiers, no lazy references,
  no queries. Text is already resolved from pinned revisions, dates already
  formatted, sections already ordered and filtered.
- **Free of private data by construction** - there is no field that could hold
  evidence. Not a runtime filter; a type-level guarantee.
- **Versioned** - `schemaVersion` on the document, so a template declares
  which document versions it supports.

The store stays typed and kind-specific. This document is where uniformity
lives.

---

## 2. Shape

```ts
type ResumeDocument = {
  schemaVersion: number;

  meta: {
    generatedAt: string;          // ISO 8601
    resumeName: string;
    locale: string;               // date and list formatting
    templateId?: string;          // absent when the resume named none
    templateConfig?: Record<string, unknown>;
  };

  header: {
    fullName?: string;
    headline?: string;
    pronouns?: string;
    location?: string;
    summary?: RichText;
    contacts: Contact[];
  };

  sections: Section[];
};
```

**The document names its template rather than resolving it.** A document is
what a renderer binds to, and which renderer that is has to survive being stored
and read back by a build holding a different set of templates. `templateConfig`
carries only the resume's overrides, so a template default that moves in a later
version moves with it.

**There is no `templateVersion`.** `renderManifest` lives in `@keepcv/core`,
which has no registry to ask, and a version string naming a build of
`@keepcv/templates` would resolve to nothing on the way back in. A slot nothing
can fill is the `links[]` mistake below.

**The header has one list, not two.** A contact channel that is a URL - a
website, a LinkedIn, a GitHub - is a `Contact` with an `href`, so a second
`links[]` beside it would be a list nothing could ever fill. `Link` remains the
type for a record's links, which is where it is actually used.

### Section

```ts
type Section = {
  key: string;                    // opaque, stable within the document
  kind: SectionKind;              // 'experience' | 'education' | ... | 'custom'
  heading: string;                // already resolved: override or template default
  layout: SectionLayout;          // 'entries' | 'inline' | 'grouped'  - a hint
  groups?: Group[];               // present only when layout === 'grouped'
  entries: Entry[];
};

type Group = {
  key: string;
  title: string;                  // e.g. the organisation name
  subtitle?: string;
  period?: Period;                // spanning period across the grouped entries
  entryKeys: string[];            // references into section.entries
};
```

`layout` is a **hint, not an instruction**. A template may ignore it. It exists
because some sections read better inline (Skills, Languages) and some benefit
from grouping (multiple roles at one organisation) - and that judgement depends
on the data, which the template does not have to re-derive.

`groups` reference entries by key rather than nesting them, so a template that
ignores grouping still renders every entry exactly once. Nesting would make
ignoring the hint a data-loss bug.

### Entry - the uniform envelope

**Every entry in every section has this shape.** It is what lets templates
never branch on record kind, and what makes adding a record kind touch no
template.

```ts
type Entry = {
  key: string;                    // opaque, stable; emitted as data-key
  kind: EntryKind;

  title?: string;                 // primary label
  subtitle?: string;              // secondary label
  organisation?: Organisation;
  period?: Period;
  location?: string;
  mode?: string;                  // 'Remote' | 'Hybrid' | ... | delivery mode

  summary?: RichText;             // the prose blurb, if any
  points: Point[];                // always present; may be empty
  tags: string[];
  links: Link[];
  fields: Field[];                // typed extras, uniformly carried
};
```

Absent slots are `undefined`. `points`, `tags`, `links` and `fields` are always
arrays - possibly empty - so templates never guard against null before mapping.
That asymmetry is deliberate: `{entry.period && ...}` is the natural conditional
for a scalar, and `entry.points.map(...)` is the natural expression for a list.

### Point

```ts
type Point = {
  key: string;
  text: RichText;                 // the chosen phrasing, pinned
  plainText: string;              // derived projection
  metrics: Metric[];
  tags: string[];
};
```

`plainText` is carried alongside `text` so that plain-text exporters, the ATS
linter and length estimation never have to walk the AST.

### Supporting types

```ts
type Period = {
  start?: string;                 // "2023-04"     raw partial date
  end?: string;
  isCurrent: boolean;
  display: string;                // "Apr 2023 - Present"  pre-formatted
};

type Contact = {
  key: string;
  kind: 'email'|'phone'|'website'|'linkedin'|'github'|'scholar'|'orcid'|'location'|'other';
  label?: string;
  value: string;                  // display text
  href?: string;                  // mailto:/tel:/https: - absent if not linkable
};

type Link  = { key: string; kind: string; label: string; url: string };

type Field = {
  key: string;                    // machine-readable: 'credentialId' | 'doi' | 'grade'
  label: string;                  // human display: "Credential ID"
  value: string;
  kind: 'text' | 'url' | 'date' | 'number';
};

type Organisation = { name: string; url?: string; location?: string };

type Metric = {
  key: string;
  label: string;
  display: string;                // "800ms -> 120ms"  pre-formatted
  value: number;
  unit?: string;
  baseline?: number;
  direction?: 'increase' | 'decrease' | 'neutral';
};
```

**Both raw and formatted values are provided** (`Period.start` and
`Period.display`, `Metric.value` and `Metric.display`). Locale-aware formatting
is done once, centrally, so twelve templates cannot format dates twelve ways -
but a template that wants its own format still can, without reparsing strings.

---

## 3. `fields[]` - how kind-specific facts stay uniform

A certification has a credential ID; a publication has a DOI; a degree has a
grade. These are real, typed, queryable facts in the store - and they must
still reach the page without every template knowing about them.

They project into `fields[]` with a stable `key` and a display `label`:

```jsonc
// certification entry
"fields": [
  { "key": "credentialId", "label": "Credential ID", "value": "AWS-1234", "kind": "text" },
  { "key": "expiresOn",    "label": "Expires",       "value": "Mar 2027",  "kind": "date" }
]
```

- A **generic** template renders every field as a `label: value` pair and
  handles record kinds that did not exist when it was written.
- A **specialised** template looks up `fields.find(f => f.key === 'credentialId')`
  and places it deliberately.

This is the property that makes user-authored templates survivable, and it is
why `fields` is a list of keyed objects rather than a free-form map.

User-defined fields (`record_field`) appear in the same array, with `key`
derived from their label. There is one slot, not two.

**Key collisions are resolved in favour of the presenter.** A user-defined
field whose derived key collides with a presenter-generated one (a hand-typed
"DOI" on a publication that already has a `doi` column) is emitted with a
suffixed key and its original label preserved. The presenter's value wins the
canonical key, because specialised templates address it by key and must not
receive user-entered data where they expect a typed column. The user's value is
still rendered - nothing is dropped - it simply does not impersonate the typed
field.

---

## 4. Keys, overflow and length budgeting

Every section, entry and point carries an opaque `key`, stable within the
document and derived from its position in it - `s0`, `s0e1`, `s0e1p2`, and the
same for a group, link or metric. Templates emit it as `data-key`.

**A field is the exception**: its key is the machine-readable name from #3,
because that is what a specialised template addresses it by, and two entries can
carry the same one. It is emitted as `data-field`, so `data-key` stays unique
within the document and can be resolved back to exactly one thing.

That is what lets the preview map a rendered element back to the thing that
produced it. `paginate` in `@keepcv/core` answers which page every key landed
on, and `lengthBudget` walks the document against that answer, so *"this point
is what pushed you onto page two"* is a lookup rather than a guess. A key the
layout never measured is reported as nothing at all, never as page one.

An element that is not a page-breaking box of its own - a metric inside a point,
a link inside an entry - takes the page of the block that contains it, and a
container that is split across pages takes the page its first block landed on.
Ranking what to drop is not built: it needs the target context to be worth
anything, and until then the budget names what sits past the limit in document
order and leaves the choice to the user.

Keys are **not** store identifiers, and a test asserts no id reaches the
document. Positional keys are why: there is nothing to resolve through, so
there is nothing for a template to look up. A resume compiled from a pinned
manifest will key the same way, since the manifest carries the same order.

---

## 5. The template contract

```ts
type ConfigField =
  | { key: string; label: string; kind: 'choice'; options: ConfigOption[]; default: string }
  | { key: string; label: string; kind: 'number';
      min: number; max: number; step: number; unit: string; default: number };

type Template = {
  id: string;
  name: string;
  version: string;
  documentVersions: number[];     // ResumeDocument schemaVersions supported
  fields: ConfigField[];
  defaultConfig: TemplateConfig;  // derived from the fields
  complianceNotes: string[];      // observations, never certification claims
  styles(config: TemplateConfig): string;
  render(doc: ResumeDocument, config: TemplateConfig): ReactElement;
};
```

**A template declares its settings rather than validating them.** `fields` is
the one statement of what a template can be configured with, and both the
validator (`configFor`) and the settings panel read it - so a template that adds
a setting needs no change in the app, and there is no second schema to drift.
That is why `Template` is not generic over a config type: config values are flat
scalars, `ConfigOf<typeof FIELDS>` recovers the exact keys and choice values for
the template's own code, and the registry stays a plain array.

**A stored config outlives the version that wrote it.** `configFor` ignores a
key the template no longer declares, fills in one it has added, and refuses a
value outside the declared range. A resume stores only its overrides
(data-model.md #9.1), so template defaults move under it.

**A template ships its own stylesheet.** `styles(config)` returns CSS - `@page`,
physical units, print rules - because none of that can be an inline style and
none of it should depend on the host's fonts, resets or colour scheme. The
preview therefore mounts a template inside an `iframe` of its own; fitting an A4
page into a browser panel is scaling, not restyling.

**The stylesheet is also where the page box is declared.** `styles(config)` sets
`--kc-page-content-height` on `:root` - the height of one page's content, in
whatever CSS length suits - and states its break rules the ordinary way, with
`break-inside: avoid` on anything that must not be split and `break-after:
avoid` on anything that must not end a page. The host resolves the length by
laying out a probe and reads the break rules with `getComputedStyle`, so it
converts no units, knows no template's class names, and cannot disagree with
what the printer will do. A template that declares no page height fails
`isATemplate`, because nothing else in the stylesheet says how long a page is.

**A template owns its layout and nothing else.** Escaping an inline mark,
tagging an element with the `data-key` the host paginates by, printing a field
as `label: value` and printing a link as its address are obligations every
template has and none may reinterpret, so they live in `prose.tsx` and each
template composes them. The page box is the same argument one level down:
`paper.ts` states `@page`, `--kc-page-content-height` and the shared page-size
and typeface vocabularies, because a template with its own copy drifts into
reporting a wrong page count rather than failing. What is left in a template's
own files - which slots go where, what is beside what, what is a heading - is
the whole of what distinguishes one from another.

**A template is a design, and a design is data.** Both shipped templates had
been code, and their two `render.tsx` files differed in exactly two places:
whether the section heading sat above the section or in a column beside it, and
whether the period sat at the right margin or ran on after the title. That is a
vocabulary, not two programs. So there is one renderer and one stylesheet
builder, `fromSpec(id, name, spec)` builds a `Template` from a `TemplateSpec`,
and the shipped designs are two specs rather than two directories. A template
the user writes is the same kind of thing as a shipped one - which is what makes
"create a template" a row rather than a fork.

The knobs live in one catalogue, split in two:

- **`FIT_KNOBS`** - page size, typeface, body size, line height, margin, section
  gap. These are what a resume adjusts to make itself fit, so they are the
  `fields` a template hands the preview panel, with the spec's values as their
  defaults.
- **`DESIGN_KNOBS`** - accent, name size, header alignment and rule, heading
  placement, column width, case, alignment and rule, date arrangement, point
  marker. These are what the template *is*. `fromSpec` layers them over whatever
  config arrives rather than under it, so a resume cannot move one.

That split is what lets `complianceNotes` be **derived** from the spec rather
than written by hand. A note claiming the headings sit beside the section is
true of every resume a template prints only because no resume can move that
knob; a note written by hand would go on being printed after the design stopped
earning it.

**A design may carry CSS of its own, and it may not fetch.** `extraCss` is
appended last so it wins, and the schema refuses `@import`, any `url()` that is
not a `data:` one, and the string `</style` - React does not escape the children
of a `style` element. Those are refusals, not lint findings, because a
stylesheet that fetches is a resume that prints differently offline. What the
CSS then does to the layout *is* a lint finding: the linter reads the rendered
file, so a user's `position: absolute` is reported exactly as a shipped
template's would be.

**A design travels as a file, and the file is a spec with a name on it.**
`templateFileSchema` is `{ name, spec }` - no id, no timestamps and no owner,
because none of those mean anything in the store it lands in. The download and
the reader both name that schema, so a file this writes is a file this accepts,
and the reading happens in the tab for the reason a resume's does: a design is
small, and the store it is going into is the only thing that has to see it. It
arrives as an ordinary create, so nothing new reaches the API, and the stylesheet
refusals apply on the way in - a design cannot smuggle past a schema the editor
enforces just by being written somewhere else.

**A version pins the whole design, not the id.** A shipped template exists in
every build, so naming it is enough. A template the user wrote is a row they can
edit, so a manifest naming one would print differently the day after it was
edited, and the version would stop saying what was sent. `captureManifest`
therefore freezes the spec into `manifest.template.spec`, `renderManifest`
carries it onto `ResumeDocument.meta.templateSpec`, and `resolveTemplate` uses
the spec ahead of the id. `renderHtml(document)` stays a pure function of the
document, which is what keeps the CLI and the browser producing the same bytes.

**Side by side is a grid, never a float, a coordinate or a column count.** A
multi-column flow splits a paragraph down the page and picks it up at the top of
the next one, which is what makes a two-column resume come back interleaved; a
grid one section deep leaves the printed order equal to the markup order. The
lint rules refuse the first three by name, so a template reaching for them fails
the suite that asserts every shipped template lints clean.

Rules:

- A template may not fetch, query, or reach outside its two arguments. Its
  stylesheet may not `@import`, and may not name a URL that is not a `data:`
  one; its markup may not link to an address the document does not carry.
- A template must render an entry it does not recognise. Falling back to
  `title / subtitle / period / summary / points / fields` is always valid,
  which is exactly what the uniform envelope guarantees.
- **Every section, entry and point prints exactly once**, tagged with its
  `data-key`. Sections a template chooses not to support must be **omitted
  visibly** (reported to the composer), never dropped silently. Silently losing
  a section is the destructive behaviour this product exists to eliminate.
- **An empty section is said out loud, not dropped.** Capture emits a visible
  section whose entries were all hidden or archived, and a heading with nothing
  under it reads as a rendering fault unless the template names the gap.
- **A grouped section prints every entry exactly once.** Groups only claim
  entries that carry an organisation, so a template that renders groups must
  also render whatever no group claimed.

### Test fixture

One `ResumeDocument` fixture in `@keepcv/templates` exercises every slot, every
`Field.kind`, all three inline marks, all three layouts, empty sections, entries
with no points, points with no metrics, an entry no group claims, and an entry of
a kind no presenter in this build emits.

**Passing that fixture is the definition of "is a template".** `isATemplate` is
the suite that asserts the rules above over it. It is also what every new export
format must render, so the fixture is shared between templates and exporters -
and the fixture has a test of its own asserting it still covers all of that,
because a template only proves as much as the fixture asks of it.

`@keepcv/render` renders it through every template in the registry, and asserts
what an exported file owes on top of what a template owes: it fetches nothing,
it adds no address the template did not print, and every element the template
printed survives into the file. An exporter that drops a section is the
destructive behaviour this product exists to eliminate, arriving one layer
lower down.

---

## 6. Presenters

The mapping from typed records to uniform entries. One per record kind, pure,
in `@keepcv/core`.

| Record kind | title | subtitle | organisation | period | notable fields |
|---|---|---|---|---|---|
| experience | job title | team | employer | started/ended | employmentType |
| education | degree | field of study | institution | started/ended | grade, thesis, honours |
| project | project name | role | associated org | started/ended | - |
| skill | skill name | proficiency | - | started/ended | category |
| certification | certification | - | issuer | issued | credentialId, expiresOn |
| publication | title | authors | venue | published | doi |
| award | title | - | issuer | awarded | - |
| language | language | proficiency | - | - | - |
| volunteering | role | cause | organisation | started/ended | - |
| speaking | talk title | event | host org | delivered | - |
| custom entry | title | subtitle | - | started/ended | user-defined |

`experience.mode` fills the `mode` **slot**, not a field - a slot and a field
are alternative destinations and nothing may occupy both. Verification,
recording and repository URLs are `record_link` rows and reach the page through
`links[]`, never `fields[]`. The rule: **anything that is a URL is a link;
anything that is a labelled value is a field.**

Presenters are the **only** place kind-specific presentation knowledge is
permitted. Adding a record kind means adding one presenter and one row to this
table - no template, exporter, or linter changes.

---

## 7. Compilation

```
store + resumeId  --captureManifest-->  manifest  --renderManifest-->  ResumeDocument
resume_version.manifest ------------------^
```

Two steps, not two paths. `captureManifest(store, resumeId)` resolves the
selection and freezes it; `renderManifest(manifest, revisions, { generatedAt,
locale })` formats it. `compile(store, resumeId, options)` is the pair, and is
what the browser preview and `GET /v1/resumes/:id/document` call. A version
pinned in March renders by handing its stored manifest to the same second step,
so there is no second compiler to disagree with the first.

Both steps are pure (`application-structure.md` #7).

Capture does, in order:

1. resolve the composition, and drop hidden sections, hidden entries, hidden
   points and archived rows
2. resolve section headings - the section's own override, then a custom
   section's heading, then the kind's default
3. pin the rows whole, and phrasing text by revision id
4. freeze the target context the resume was aimed at, and the template it chose
   with the configuration it chose - a template swapped in June must not change
   how a version captured in March prints

Render does, in order:

1. resolve each pinned revision id to its text
2. run the presenter for each record kind
3. compute groups where the layout hint calls for it
4. format dates, metrics and contacts for `meta.locale`
5. assign keys

Nothing renders that capture did not pin, which is why every filter lives on one
side of the line and every formatting decision on the other.

Because compile is pure and deterministic, the same manifest always produces
the same document - which is what makes render output content-addressable and
cacheable.
