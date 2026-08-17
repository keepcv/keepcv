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

**No `templateId` or `templateVersion` in `meta` yet.** There is no template
package for them to name, and a resume carries no template columns
(data-model.md #9.1). They arrive with the Templates capability, alongside the
columns.

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
same for a group, link, field or metric. Templates emit it as `data-key`.

That is what lets the preview map a rendered element back to the thing that
produced it, which in turn makes these expressible:

- *"This point is what pushed you onto page two."*
- *"Drop these three lowest-tagged points to fit."*

Keys are **not** store identifiers, and a test asserts no id reaches the
document. Positional keys are why: there is nothing to resolve through, so
there is nothing for a template to look up. A resume compiled from a pinned
manifest will key the same way, since the manifest carries the same order.

---

## 5. The template contract

```ts
type Template<C> = {
  id: string;
  version: string;
  documentVersions: number[];     // ResumeDocument schemaVersions supported
  configSchema: ZodType<C>;
  defaultConfig: C;
  complianceNotes: string[];      // observations, never certification claims
  render(doc: ResumeDocument, config: C): ReactElement;
};
```

Rules:

- A template may not fetch, query, or reach outside its two arguments.
- A template must render an entry it does not recognise. Falling back to
  `title / subtitle / period / summary / points / fields` is always valid,
  which is exactly what the uniform envelope guarantees.
- Sections a template chooses not to support must be **omitted visibly**
  (reported to the composer), never dropped silently. Silently losing a
  section is the destructive behaviour this product exists to eliminate.

### Test fixture

One `ResumeDocument` fixture in `@keepcv/templates` exercises every slot, every
`Field.kind`, all three inline marks, grouped and inline layouts,
empty sections, entries with no points, and points with no metrics.

**Passing that fixture is the definition of "is a template".** It is also what
every new export format must render, so the fixture is shared
between templates and exporters.

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
4. freeze the target context the resume was aimed at

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
