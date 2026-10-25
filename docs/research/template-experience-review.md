# Templates and resumes: workflow review

Reviewed 2026-10-24 against latest `origin/main`, commit `8e43845`.

This is a hands-on expert walkthrough and research synthesis, not a study with
representative users. Findings describe observed behavior; proposed remedies
still need task-based usability validation.

## Review setup

A clean checkout ran the full launcher, API and PGlite store against a separate
throwaway data directory. The review used an empty store, then sample career
content, two resumes and one custom template. No personal store was used.

Desktop viewport: 1280 x 800. Narrow viewport: 390 x 844. The walkthrough covered
the template list, creation form, custom-template editor, template-to-resume
creation, resume list, Content workspace, Preview and export, font/spacing
controls and template switching. DOM measurements supplemented visual review.

## Observed workflow

```text
Templates
  -> Use template
     -> Resumes / New resume form
        -> name + template dropdown
           -> Create resume
              -> Content workspace

Templates
  -> New design / Customize copy
     -> name + Based on dropdown / JSON file
        -> Create design
           -> separate template editor
              -> automatic changes to every current resume using it

Resume
  -> Preview and export
     -> Template and export panel
        -> template dropdown + Edit shared design + Font and spacing
```

## Findings

| Priority | Observation | Usability consequence |
| --- | --- | --- |
| High | The list says Templates, the create button says New design, the form says Based on, and editing from a resume says Edit shared design. | A person must infer which terms describe the same reusable object and which changes affect a single resume. |
| High | Use template opens creation of a new resume. It does not apply the template to an existing resume. | The action's destination and scope are unclear until after navigation. |
| High | Built-in names are plain text and have no full preview action. User-template names are edit links. | Identically positioned objects have different behavior, and someone cannot inspect a built-in before copying or using it. |
| High | The list has small structural sketches, and creation uses names in a dropdown without a preview. | Choosing a visual design requires remembering names and trial-and-error creation. |
| High | After selecting US Letter in a resume, selecting Single column reset page size to A4 immediately. | Browsing another template also discards fit choices without a separate reset action. This was reproduced with the UI. |
| High | Editing a custom template autosaves across every current resume using it. The header explains this, but the editing controls do not distinguish a local experiment from a shared update. | Someone arriving from one resume can change other resumes while experimenting. |
| High | The template editor has layout/style controls but no page size, typeface, body-size, line-height, page-margin or section-gap controls. Those are elsewhere in the resume view. | Making a reusable template requires understanding an invisible division of settings. |
| High | The sample preview is flush against the page edges. The page element computed to 0px padding even though the configured margin was 18mm. | The screen preview misrepresents the intended page margins. The stylesheet's general reset overrides screen page padding; print uses a separate page-margin rule. |
| Medium | The template editor has no undo/redo and uses a separate Rename action while style settings autosave. | Experiments have no clear recovery action, and saving rules depend on which control was used. |
| Medium | Preview and export combines file actions, format-loss information, checks, page limit, template choice, font settings, save state and template notes. | Several different tasks compete in one narrow column. Template choice sits below export controls. |
| Medium | The Content workspace uses much of its width for nested selection controls while its live paper is very small. | The document is useful as a layout overview but difficult to read at the default scale. |
| Medium | At 390px width, the resume preview frame began at y=860 on an 844px-tall screen. | The initial Preview and export view showed controls but none of the document. |
| Medium | The narrow template editor presents independently scrolling controls and paper stacked in the same view. | Touch users must manage multiple scroll regions to connect an adjustment to its result. |
| Medium | The default sample exposes a conformance fixture: many content types, unusual fields and intentionally awkward text. | It proves renderer coverage but is a poor first impression of a realistic finished resume. |
| Low | The navigation count showed one template while the gallery counted three designs, because the navigation counted owned rows and the list included built-ins. | The numbers appear inconsistent without explaining ownership. |
| Low | A record said two selected points while one was hidden. | Selection and printed visibility are different, but the count does not make that distinction clear. |

These are prioritized review judgments, not measured failure rates. No claims
are made here about how often real users encounter them.

## Research and implications

### Recognizable choices and explicit scope

[Nielsen Norman Group's usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
support consistent terminology, visible system status, recognizable choices,
recoverable actions and prevention of mistakes. Applied here, a person should
see the design before choosing it and know whether an action affects one resume
or a reusable template. This is our application of those principles, rather
than evidence that any particular layout will outperform another.

[Canva's template workflow](https://www.canva.com/help/use-templates/)
allows previewing a template before entering customization, including browsing
from an existing editor. That supports testing a shared visual picker from both
KeepCV entry points, with context-specific actions.

[Microsoft's template guidance](https://support.microsoft.com/en-us/word/create-a-template)
distinguishes editing a reusable template from creating a document based on one.
Its [screen-reader guide](https://support.microsoft.com/en-au/accessibility/word/use-a-screen-reader-to-work-with-templates-in-word)
also explicitly describes a newly created document as separate from its source
template. KeepCV's shared current-template behavior differs, so that scope must
be made visible instead of relying on expectations imported from document apps.

### Controls that explain their effects

[RenderCV's design documentation](https://docs.rendercv.com/user_guide/yaml_input_structure/design/)
groups page, typography and other design settings and describes themes as
configurations. KeepCV can expose its existing design vocabulary through grouped
controls without requiring people to learn a file format.

[W3C labels and instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions)
supports visible labels and necessary input guidance.
[W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
supports save and error feedback that assistive technology can announce without
moving focus. [Target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
sets a 24 x 24 CSS-pixel minimum with defined exceptions. The proposed touch
layout aims for larger, 44px targets where practical; that is a design target,
not a claim about the minimum standard.

### Rendering remains a product requirement

[MDN's grid accessibility guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Accessibility)
explains that visual placement does not replace logical source order.
[MDN's printing guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing)
describes print media and physical page rules. KeepCV should retain one renderer,
logical reading order and browser printing, while verifying screen margins,
page measurement and print behavior against each other. This research does not
justify a free-position canvas or a second PDF layout engine.

## Recommended direction

Use one vocabulary: Template, System template, My template, Resume and Fit.
Provide a shared visual chooser with a real preview before a contextual action.
Keep system templates read-only. Make shared edits deliberate, with explicit
save and affected-resume scope. Keep fit adjustments local to the resume and
preserve them through template changes unless a reset is explicitly chosen.
Separate design work from export work and make paper visible on narrow screens.
The default resume preview should show the document and a PDF action; template
notes, fitting, detailed checks and alternative formats belong behind distinct
task-specific controls rather than a permanent mixed sidebar.

The proposed screens, workflows and acceptance criteria are in the
[overhaul plan](../plans/template-experience-overhaul.md).
