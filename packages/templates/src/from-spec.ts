import { RESUME_DOCUMENT_SCHEMA_VERSION, type TemplateSpec } from "@keepcv/schema";
import { defaultsOf, type Template, withDefaults } from "./contract.js";
import { DESIGN_KNOBS, designOf, FIT_KNOBS } from "./knobs.js";
import { render } from "./render.js";
import { stylesheet } from "./styles.js";

// Derived, not written by hand: a note typed here would go on being printed
// after the design stopped earning it.
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
  // Layered over whatever config arrives rather than under it, so what the
  // template is cannot be moved by a resume that stored a design key. That is
  // what makes the notes above true of every resume this template prints.
  const design = defaultsOf(withDefaults(DESIGN_KNOBS, spec.settings));

  return {
    id,
    name,
    version: "1.0.0",
    documentVersions: [RESUME_DOCUMENT_SCHEMA_VERSION],
    fields,
    defaultConfig: { ...defaultsOf(fields), ...design },
    complianceNotes: notesFor(spec),
    styles: (config) => stylesheet({ ...config, ...design }, spec.extraCss),
    render: (document, config) => render(document, { ...config, ...design }),
  };
}
