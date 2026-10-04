import { extraCssSchema, RESUME_DOCUMENT_SCHEMA_VERSION, type TemplateSpec } from "@keepcv/schema";
import { defaultsOf, type Template, withDefaults } from "./contract.js";
import { DESIGN_KNOBS, designOf, FIT_KNOBS } from "./knobs.js";
import { render } from "./render.js";
import { stylesheet } from "./styles.js";

function notesFor(spec: TemplateSpec): string[] {
  const design = designOf(spec.settings);

  return [
    design.headingPlace === "beside"
      ? "Section headings sit in a column beside the section rather than above it, laid out as a grid one section deep - so no paragraph is ever split down the page and picked up again at the top."
      : "One column: the page prints in the order the markup reads, so an extractor recovers the same order.",
    design.entryMeta === "inline"
      ? "Dates print in the running text after the role and the place, rather than out at the right margin where an extractor has to guess what they belong to."
      : "Dates print as text beside the entry they belong to, formatted for the document locale.",
    "Headings are ordinary text, never images or table cells.",
    "Every contact prints its own value, so a linked address survives being read as plain text.",
    "A field prints its label, a colon and its value, so the pair survives extraction.",
    "No tables, no text inside an image, and no font this document has to fetch.",
    ...(spec.extraCss.trim() === ""
      ? []
      : [
          "This design carries extra CSS of your own. The findings above are read off the file it produces, so anything that CSS moves is reported there.",
        ]),
  ];
}

export function fromSpec(id: string, name: string, spec: TemplateSpec): Template {
  const fields = withDefaults(FIT_KNOBS, spec.settings);
  const design = defaultsOf(withDefaults(DESIGN_KNOBS, spec.settings));
  const css = extraCssSchema.safeParse(spec.extraCss);

  return {
    id,
    name,
    version: "1.0.0",
    documentVersions: [RESUME_DOCUMENT_SCHEMA_VERSION],
    fields,
    defaultConfig: { ...defaultsOf(fields), ...design },
    complianceNotes: [
      ...notesFor(spec),
      ...(css.success
        ? []
        : [
            "Extra CSS was omitted because it contains unsafe or unsupported CSS. The saved design is unchanged.",
          ]),
    ],
    styles: (config) => stylesheet({ ...config, ...design }, css.success ? css.data : ""),
    render: (document, config) => render(document, { ...config, ...design }),
  };
}
