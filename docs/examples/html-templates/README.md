# HTML template examples

These three read-only system templates ship in the application. Their canonical
HTML, CSS and shared entry partial live in the templates package, so these
examples do not maintain a second copy of the source.

| Example | Direction | Definition |
| --- | --- | --- |
| Studio | Graphic poster with oversized type, citrus/pink geometry and numbered strips | [Studio](../../../packages/templates/src/html/samples/studio.ts) |
| Signal | Orange portfolio contact sheet with tilted panels and circular stamp | [Signal](../../../packages/templates/src/html/samples/signal.ts) |
| Folio | Restrained serif editorial comparison | [Folio](../../../packages/templates/src/html/samples/folio.ts) |

The shared [entry partial](../../../packages/templates/src/html/samples/entry.ts)
prints points, dates, custom fields, links, tags and metrics. All three consume
the same selected data contract. Make a copy in the app to customize one.

After `pnpm build`, run:

```sh
node docs/examples/html-templates/render.mjs
```

It validates the canonical definitions, checks content markers, and writes
self-contained HTML plus importable template JSON into
`.keepcv-html-template-research/rendered`. Open index.html there to compare.
HTML previews contain [sample resume data](sample-resume.json); template files
contain only source and bundled assets. No separate engine installation is needed.

Studio and Signal target creative professions. Their text remains selectable
and DOM order follows the selected content. Print colors depend on background
printing settings. Arbitrary HTML layouts have no accurate page estimate; inspect
browser print preview. These designs make no ATS certification claim.

The [binding guide](../../TEMPLATES.md), [implementation plan](../../plans/template-types-and-html.md)
and [security review](../../research/html-template-security.md) describe the
language, source policy and limits. Regression cases live in the
[actual renderer tests](../../../packages/templates/src/html/html.test.ts).
