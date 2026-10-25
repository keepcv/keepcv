# Templates and resume design

Templates hold reusable layout and style. A resume chooses a template and its
own content. Fit settings adjust one resume without changing the template.

## Choose a template

Open Templates. **System templates** are provided by the app and are read-only.
**My templates** contains designs you create, copy or import. Use the search box
to find a name or style. Select a card to inspect it. **Create resume** starts a
new resume using that template; it does not replace an existing resume.

The app provides Single column, Left headings, Classic, Modern, Compact and
Editorial, plus HTML templates Studio, Signal and Folio. Studio and Signal are
creative layouts for portfolio-oriented work. Original templates already in use remain available so older resumes
and saved versions retain their design.

To change an existing resume, open **Design -> Change template**. Browse and
preview alternatives, then choose **Apply to this resume**. Cancel leaves the
resume unchanged. Your fit settings are kept unless you check **Use template
defaults**. Content, wording, section order and page limit remain unchanged.

## Create or customize

**Create template** opens the visual builder immediately. For a starting design,
open a system template and choose **Make a copy**. Both produce your own editable
template when you save. **Import template** opens a downloaded template as a draft.

| Controls | What changes |
| --- | --- |
| Page and spacing | A4/US Letter, margins and space between sections |
| Typography and color | System typeface, body size, line height and accent |
| Name and header | Name size, alignment and the header rule |
| Section headings | Placement, width, size, case, alignment and rules |
| Entries and points | Date arrangement, entry spacing, markers and point spacing |

Expand the group you need. Numeric controls support a slider and exact entry.
Heading-column width appears only with side headings. Selecting a preset accent
replaces the custom accent. Fonts use local system stacks; another machine may
substitute a similar installed font.

**Preview content** shows a realistic sample, one of your resumes, or test
content exercising all supported types. It uses the template's defaults and
does not change the source resume. Use fit-to-width or zoom to inspect the paper;
multi-page previews offer page navigation. Readability checks are advisory.

## Save deliberately

Changes remain a browser draft until **Save template** succeeds. A shared
template shows which current resumes saving will update. Previously saved
versions keep their design. **Save as new template** creates another template
while leaving the original and its resumes unchanged.

Undo and Redo work throughout the editing session, including after saving.
Reset controls uses the default settings and keeps custom CSS. Discard changes
returns to the stored copy. Ctrl-S or Cmd-S saves; native text undo still works
inside text fields.

A failed save retains inputs and offers Retry saving. Leaving offers to save,
keep the browser draft, or continue editing. Reopening recovers pending input
when browser storage is available. Recovery is scoped to the connected store.
It is separate from the native backup, so save templates before relying on a
backup to contain them.

When making a copy from a resume, saving returns to that resume with the new
template preview selected. Apply it to use it; Cancel keeps the previous choice.

## Fit and export a resume

Design starts with the document. Open **Fit and checks** to adjust page size,
font, body size, line height, margins, section spacing and page limit for this
resume only. Individual overrides or all fit settings can be reset to template
defaults. These adjustments save automatically.

**Export PDF** is available in the resume header and opens the browser's print
dialog, where you can print or save a PDF. **Other formats** offers HTML, a
personal web page, Word, JSON Resume, LaTeX and Typst. A selected format shows
only the losses that apply to this resume. Readability checks and page-limit
warnings do not gate export. Check the final print preview before sending.

On narrow screens, switch between Preview and Controls. The builder similarly
switches between Edit template and Preview.

## Template files and optional CSS

**Download template file** saves the visible source and settings, even if a
server save failed. It includes no resume content. Importing creates a separate
user-owned template. A file has this shape:

```json
{
  "name": "My navy template",
  "spec": {
    "settings": { "accent": "navy", "fontFamily": "georgia", "entryGap": 7 },
    "extraCss": ""
  }
}
```

Omitted settings take their defaults; unsupported values fall back to supported
values. The builder creates this format without requiring you to learn its keys.

Advanced CSS is optional, local and limited to 4,000 characters. Common selectors
include `.kc-name`, `.kc-header`, `.kc-heading`, `.kc-entry` and `.kc-points`.
Imports, external resources and closing style tags are refused. Invalid CSS stays
editable, is omitted from the Default preview, and disables saving. Source
download remains available for recovery.
Keep text visible and in logical reading order. Checks report observations and
do not certify compatibility with any particular system.

Archive and Restore live in My templates. Archiving hides a template from new
choices while preserving resumes already using it.

## Author an HTML template

Choose **Start an HTML template** in Create template, or copy Studio, Signal or
Folio. The type is HTML; the other builder is **Default (visual)**. The library's
type filter helps find either. System ownership and template type are separate.

**Files and code** edits HTML fragments, CSS, local partials and bundled assets.
Select a bundle file to edit it. Use a unique path to add or rename a file, choose
the entry HTML and enable stylesheets in load order. **Page defaults** sets the
template's starting page size and margin using its declared controls. Update source references
after a rename. Remove file can be undone. Assets can be PNG, JPEG, static WebP
or WOFF2; refer to them by bundle path, such as assets/photo.png. External URLs
are allowed for hyperlinks, but fetched images, fonts and stylesheets are refused.

**Resume data** searches the fields available from the selected preview resume,
shows sample values and copies/inserts bindings. Arrays follow the resume's
composition order. An optional field may be absent and any list may be empty.
The same data explorer is available in Design controls and the template chooser
used when creating a resume. It never grants access to the underlying store,
private evidence, drafts or unselected contacts/wording.

```liquid
<h1>{{ resume.header.fullName | default: "" }}</h1>
{% if resume.header.summary %}
  <div>{% rich_text resume.header.summary %}</div>
{% endif %}
{% for section in resume.sections %}
  <section data-key="{{ section.key }}">
    <h2>{{ section.heading }}</h2>
    {% for entry in section.entries %}
      {% render "partials/entry.html", entry: entry %}
    {% endfor %}
  </section>
{% endfor %}
```

The language resembles a small subset of Liquid; it is not full LiquidJS.
Text interpolation escapes HTML. Use rich_text for summary/point text, and loops
for sections, entries, points, fields, links, metrics and tags. Groups reference
entries with entryKeys; `section.entries | in_group: group.entryKeys` selects
that group's entries in key order. `forloop.index`, index0, first, last and length
are available inside a loop. Indexed explorer paths show one example item.

Supported tags are assign, if/unless/elsif/else, for/else, render and rich_text.
Filters are default, join, where, first, last, size, upcase, downcase, capitalize,
slice and in_group. Conditions support ==, !=, >, <, >=, <=, contains, and, or.
Partials use literal local paths and explicit named arguments. There are no
JavaScript functions, dynamic includes, raw output filters or external loaders.

Keep HTML as body fragments: the app supplies html/head/body, security policy
and @page. Use page.size and page.marginMm for effective page settings; CSS can
use --page-width, --page-height and --page-margin. Scripts, event handlers, forms,
embedded documents, SVG, navigation metadata, animation and remote resources
are refused. Errors identify the file and line where available. Invalid source
is retained for correction, and never replaces the saved definition.

Templates allow at most 64 files, 512 KiB source and 1 MiB decoded assets. Rendering
has bounded work/output and a browser-worker timeout. A failed render displays
an error instead of an old preview; Retry preview tries the current source again.
Readability warnings are advisory and independent of these technical rules.
HTML page estimates are unavailable. Inspect browser print preview before sending.

Saving creates a versioned definition envelope. Older Default files still import:

```json
{"name":"My template","spec":{"type":"default","version":1,"payload":{"settings":{},"extraCss":""}}}
```

HTML payloads contain documentVersions, entry, styles, files and page. Download
one of the [system examples](examples/html-templates/README.md) for a complete
bundle. Source files contain no preview resume data unless you write it literally.
Native backup includes saved bundles and pinned history. Unsupported future types
remain downloadable and backed up, but require their handler before rendering.
LaTeX source export still uses its existing writer; a LaTeX template type and
compiler are not included in this release.
