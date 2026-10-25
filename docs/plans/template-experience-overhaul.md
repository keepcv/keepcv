# Template and resume experience overhaul

Status: implemented; final validation follows the acceptance tasks below.
Baseline: latest main, `8e43845`. Prepared 2026-10-24.

The [workflow review](../research/template-experience-review.md) records observed
problems and research sources. This plan replaces the earlier assumption that
adding more controls to the template editor is sufficient. It records the
workflow decisions behind the implementation; user guidance is in
[Templates and resume design](../TEMPLATES.md).

## Outcome and scope

A person can inspect a template, use it on a resume, adjust that resume's fit,
or make their own reusable template without wondering what will change or what
has been saved. They can complete those tasks without JSON or CSS.

The work includes the Templates library and builder, template selection during
resume creation, design controls in an existing resume, preview/export access,
improved defaults, additional system templates, and compatibility with existing
resumes and history.

It does not redesign career-data entry, change how points or revisions work,
introduce a template marketplace, execute template code, add remote fonts, or
introduce a second compiler or PDF layout engine.

## The concepts shown to users

| Concept | Meaning | Where it can change |
| --- | --- | --- |
| System template | A finished design supplied by the app | Read-only; customization creates a user-owned copy |
| My template | A reusable design created or copied by the user | Template builder, with explicit saving |
| Resume | A chosen set of career content using a template | Resume workspace |
| Fit settings | Paper size, font, body size, line height, margins and section spacing for this resume | Resume Design view; changes affect this resume only |
| Template defaults | The starting values supplied by a reusable template | Builder for user-owned templates |

Use Template consistently in buttons, headings, help and file actions. Retire
New design, Create design and Edit shared design as competing names for the
same object. Use Create template, Save template and Edit template instead.
Keep Point, Version, Snapshot and Revision terminology unchanged.

## Templates library

The primary actions are Create template and a secondary Import template.
They can share creation logic without forcing file import into the normal
visual-creation form.

Show System templates and My templates as clearly labeled groups. Search and
ownership filtering appear as the collection grows. Archived templates belong
to My templates; system templates have no rename, archive or edit controls.
Counts state which collection they count rather than mixing owned and system
totals. An empty My templates group offers Create template without making the
whole library appear empty.

Cards show a larger representative thumbnail, name, ownership and a short
observable description such as "Serif, centered header" or "Compact spacing".
The thumbnail depicts typography, accent and heading placement; it is not
presented as a verified screenshot. Selecting any card opens the same preview
surface. Only the selected preview lays out a full resume.

The preview offers Sample resume or the person's own resume content, uses the
same renderer as export, and labels the content source. A curated realistic
sample is the default; comprehensive test content is an advanced preview option.

Actions depend on context:

| Entry point | Primary action | Secondary action |
| --- | --- | --- |
| Templates library, system template | Create resume with this template | Make a copy |
| Templates library, my template | Create resume with this template | Edit template; Duplicate in secondary actions |
| Existing resume's chooser | Apply to this resume | Make a copy and customize |
| New-resume creation | Use this template | Preview another template |

Applying to an existing resume never creates another resume. Creating a new
resume is always named explicitly. The library may also offer Use on an existing
resume as a secondary action that asks which resume, then opens that resume's
chooser. It must not guess a destination from the most recently opened resume.

## Creating and editing a template

Create template opens the builder immediately with either a clean starting
layout or the chosen copy. Naming and saving should not be prerequisites for
seeing whether the builder can produce the desired design. Unsaved creation is
a recoverable browser draft until Save template succeeds.

Keep one builder for fresh templates, system-template copies, duplicates and
imports. A system source is never changed by editing its copy. An imported file
opens as an unsaved user-owned template with visible validation errors.

```text
Templates > My template                     Unsaved changes
Template name                 Undo  Redo  Save as new  Save template
Used by 3 resumes - saving updates their current appearance

Controls                      Live preview
  Layout                      Sample resume / one of my resumes
  Typography                  Fit to width / 100% / zoom controls
  Color                       [paper with visible margins]
  Header                      Measured page count and page boundaries
  Section headings
  Entries and points          Readability checks
  Page defaults
  Advanced CSS
```

Group settings by visible page parts. Use controls with meaningful labels,
units, keyboard support and short effect descriptions. Show heading-column
width only when that layout uses it. Offer a custom color with a readable
contrast advisory, point markers, heading size, entry spacing and point spacing.
Allow exact numeric entry alongside sliders for precise values.

Clearly distinguish page defaults from design rules, without requiring users
to learn internal knob categories. Explain that an existing resume may have its
own fit settings. Changing preview content does not apply the template or change
the selected resume.

Use explicit Save template for reusable templates. Keep a browser recovery copy
as controls move, but do not autosave experiments into every linked resume.
Show Unsaved changes, Saving, Saved or Could not save. Retain inputs after a
failure, offer Retry, and protect navigation with pending input. Support Ctrl-S
and Cmd-S, plus session undo/redo that also works after a successful save.

For an existing user template, show its usage count persistently and let the
person inspect the affected resumes. Save template updates that reusable object;
Save as new template preserves the original. Do not add a repeated confirmation
dialog to every save: the action label and visible scope should carry the choice.
Discard changes and reset controls are separate, clearly named operations.

Keep CSS optional and collapsed. Display errors at the field, explain when
invalid CSS is omitted from preview, and retain it for correction. Design-file
download is named Download template file, separate from saving to the library.
It writes a valid visible template draft, excludes resume content and explains
how to import it again. Existing design files remain readable.

## Resume creation and workspace

New resume asks for a name and uses the same visual template chooser, including
system templates and My templates. A recommended template is preselected so the
person can continue quickly. Starting from the library retains that explicit
choice. The next screen gives an empty resume a clear Add content action.

In a resume, use Content, Design, Job target and History as the task views.
Remove Preview and export as a combined task. Make Export PDF a persistent
primary action in the workspace header, with Other formats in a secondary menu.
Existing links to Preview and export should land in Design rather than break.

Content retains section, record and point selection, drag and keyboard ordering,
visibility and a layout preview. Keep selection counts separate from the
workspace's hidden-item indicator. Full record and wording editing stay in their
existing screens.

Design makes the current template and its ownership visible beside the paper:

```text
Software engineer                    Saved       Export PDF  [More]
Content | Design | Job target | History

Template: Modern [System]                 [live paper]
Change template                          [page boundaries]
Make a copy and customize                 [zoom]

Fit this resume
  Page size, font, body size, line height
  Margins, section spacing, page limit
  Reset fit to template defaults

These fit settings affect this resume only.
```

The sketch shows the available tools, not a requirement to expand all of them.
The initial Design view shows the paper, a compact current-template row with
Change template, a page indicator and the PDF action. Fit this resume and
Readability checks are collapsed until requested. Move Make a copy and customize
into the template's secondary actions. Avoid introducing a replacement wall of
settings under a new tab name.

Change template opens the visual chooser with this resume's content. Selection
changes only the candidate preview. Apply to this resume commits the choice;
Cancel leaves the current template and settings unchanged. Preserve content,
section order, wording choices, visibility and page limit.

Keep existing fit overrides by default. Offer Use template defaults as an
explicit alternative, and show the choice next to Apply. Switching a template
must not silently change US Letter to A4. Show which fit controls differ from
the current template's defaults and allow resetting them individually or all
together. Fit adjustments autosave to this resume with visible status.

Make a copy and customize opens the builder with a recoverable return context.
Saving the new user template returns to the originating resume and offers
Apply to this resume. Canceling does not apply anything. Editing an existing
reusable template remains available as a secondary action, labeled with how many
resumes it affects. Preserve the return location so no one has to find their
resume again.

## Make preview and export minimal

The document is the primary content. There is no permanent export/settings
sidebar, no Template and export disclosure, and no repeated template notes or
storage/privacy explanations beside the paper.

| Current option | Proposed home |
| --- | --- |
| Print or save as PDF | Persistent Export PDF action; opens the browser print/save dialog |
| Download HTML | Other formats menu |
| JSON Resume, Word, LaTeX, Typst and portfolio HTML | Other formats; show format-specific help only after selection |
| Template selection | Compact current-template row in Design, opening the visual chooser |
| Edit shared design | Template secondary actions, with ownership and affected-resume scope |
| Font and spacing | Collapsed Fit this resume controls in Design |
| Page size, margins and page limit | Fit this resume; never part of the export menu |
| Readability findings | Collapsed checks in Design; show a concise issue count when needed |
| About this template and compliance notes | Template detail/preview in the Templates library |
| Saving and retry status | One workspace-level status; never another settings group |
| Format-loss explanations | Only beside the selected non-PDF format when actual content is affected |

Export PDF goes directly to the existing print path, with no mandatory export
wizard. Brief help can explain the browser dialog when needed. Other formats
does not open a second appearance editor: it offers the file choices and, for a
lossy choice, a small contextual review with a clearly named download action.
Do not show every possible loss or a zero-loss report before a format is chosen.

Readability checks and page-limit warnings advise rather than gate export.
Before exporting, settle pending resume writes and export the document actually
shown. A failed save must not create history claiming a different document was
exported. Necessary errors remain visible; simplification does not hide refusals.

## Narrow screens and keyboard use

Make the document visible without scrolling through the entire tool panel.
Use a compact toolbar and Preview / Controls switch, preserving both states.
The template chooser can use a full-screen sheet on narrow containers. Keep
Apply, Save and Cancel reachable, avoid nested independent scroll regions, and
make ownership/scope information available without hover.

Provide fit-to-width, readable zoom and page navigation. At 100% zoom, horizontal
panning belongs to the paper area, not to the whole application. Inputs retain
visible labels, focus indication and error associations; save outcomes are
announced without stealing focus. Selection remains keyboard operable, and
reordering continues to offer both drag and keyboard controls.

## System template collection

Ship six active system templates. Refresh the existing Single column and Left
headings designs, then add four designs with distinct typography, structure or
density. These names identify the active collection.

| Template | Intended visual distinction |
| --- | --- |
| Single column | Restrained sans-serif default, clear hierarchy, comfortable spacing |
| Left headings | Narrow section-heading column with balanced widths and reliable wrapping |
| Classic | Serif typography, centered name, conventional section rules |
| Modern | Strong sans-serif name, subtle accent, open spacing and minimal rules |
| Compact | Tighter entry/point rhythm and margins, with readable body text |
| Editorial | Serif typography and side headings with a distinct hierarchy |

Do not describe any template as certified for an ATS. All render every supported
slot, preserve logical reading order, remain usable in monochrome, work offline
and undergo readability checks. Test short and long names, wrapped headings,
long URLs, missing dates, grouped entries, custom sections and multiple pages.

Give refreshed system designs new immutable identities. Retain original ids
for existing resumes and history, offering them as Original when already in
use. New resume creation explicitly selects a refreshed default. Preserve the
legacy fallback for historical documents that never recorded a template id;
changing a global fallback would otherwise change their appearance. Never
silently remap old resumes or rewrite append-only history.

System ownership is structural: system definitions are not editable user rows.
User templates retain owner scoping and ordinary archive/restore behavior.
Archive removes a user template from new choices while preserving resumes that
already use it. System-template updates ship as new identities when their
appearance changes materially.

## Delivery approach

- **Agree on the workflows through reviewable mockups.** Show the library,
  chooser, builder, resume Design and narrow-screen layouts with their real
  action labels. Walk through the tasks below before adding further controls.
- **Correct the shared paper preview.** Resolve the margin-reset defect, then
  compare physical page dimensions, usable height, pagination and print output
  for A4 and US Letter. Establish a trustworthy preview before tuning designs.
- **Build the shared chooser and ownership presentation.** Reuse it in the
  library, new-resume flow and existing-resume flow, with context-specific actions.
- **Complete builder saving and round trips.** Implement explicit shared save,
  recovery, undo/redo, exact controls, file import/download and return-to-resume.
- **Reshape the resume Design and Export tasks.** Remove the permanent mixed
  settings/export panel, keep the default view focused on paper and PDF export,
  preserve fit on template swaps, and finish responsive interactions.
- **Tune and validate the system collection.** Compare actual outputs rather
  than only settings, preserving legacy resolutions and pinned history.
- **Validate complete journeys.** Exercise the real launcher with throwaway
  data, keyboard and touch-size layouts, failures, native backup/restore and
  release checks. Update user guidance and tracked architecture with the code.

These are implementation dependencies within one complete overhaul, not a
numbered feature scheme or permission to merge an incomplete user journey.

The tracked specifications need corresponding updates when implementation
lands: template ownership and compatible identities in template-model.md;
library, builder saving, Design, Export and mobile workflows in
application-structure.md; the delivered inventory in capabilities.md. Existing
decisions to autosave shared template settings and to combine appearance with
export are being reconsidered explicitly, rather than silently bypassed.

## Acceptance tasks

- From an empty store, inspect all system templates at full preview size,
  understand that they are read-only, and create a resume without a file upload.
- From Templates, create a user template from scratch, name and save it, reopen
  it, edit it, undo/redo and download/import it without JSON knowledge.
- Copy a system template and verify only the saved user-owned copy changes.
- From an existing resume, preview several alternatives, cancel without a
  write, then apply one without creating another resume or changing its content.
- Set US Letter and a custom margin, switch template, and verify those fit
  values remain unless Use template defaults was explicitly chosen.
- Customize from a resume, save a copy, return to that resume and apply it
  without accidentally updating other resumes.
- Edit a user template used by multiple resumes and identify which ones will
  change before saving. Save as new must preserve the original users.
- At narrow width, reach the preview, template change, fit controls and Export
  without navigating multiple nested scroll areas or relying on hover.
- Open Design and see the document immediately. Template notes, fit controls,
  page-limit controls, format lists and detailed checks must not all be expanded.
- Export PDF directly from the workspace. Open another format without being
  shown template-editing controls or unrelated format-loss explanations.
- Refuse a save, interrupt a connection and reopen the editor; preserve pending
  inputs and show the actual stored/unsaved state. Invalid CSS stays recoverable.
- Archive and restore a user template without losing its existing resume use.
- Render original system ids and historical documents with no recorded template
  id through the compatibility path; current work must not rewrite history.
- Export the shown resume, verify print margins and page breaks, and restore a
  native backup containing user templates and saved history.

Use these tasks for both automated integration coverage and a small observed
usability round. The key observation is whether a person can predict scope,
next destination and save state without an explanation from the implementer.

## Implementation validation

The implemented workflows were reviewed on 2026-10-25 in the full launcher
against a throwaway store at desktop 1280 x 800 and narrow 390 x 844 sizes.
All six active system templates rendered the sample without horizontal page
overflow. System details exposed copy and resume-creation actions without edit
controls. The builder saved a named user copy and remained usable at narrow
width. Header actions wrap, and the chooser keeps Apply and Cancel inside the
viewport while its choices scroll independently.

The all-types preview exercised multiple pages and page navigation. DOM
measurements verified physical screen margins; applying the print media rules
removed screen padding and retained the corresponding `@page` margins.
This is a CSS and browser-layout check, not a comparison against every printer.

Integration coverage exercises cancel and Apply, fit preservation and explicit
reset, return from the builder, save as new, unfinished drafts, legacy recovery,
archive/restore and original template resolution. Temporarily restoring the
unconditional fit reset made the preservation test fail on its US Letter,
margin and body-size assertion; the correct implementation was then restored.
The full workspace check and isolated installed-editor release check pass,
including native backup/restore and export paths.

This remains an expert walkthrough. A study with representative users has not
been performed.
