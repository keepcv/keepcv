import { RESUME_DOCUMENT_SCHEMA_VERSION } from "@keepcv/schema";
import { defineTemplate } from "../contract.js";
import { FIELDS } from "./config.js";
import { render } from "./render.js";
import { styles } from "./styles.js";

export const atsLeftHeading = defineTemplate({
  id: "ats-left-heading",
  name: "Left headings",
  version: "1.0.0",
  documentVersions: [RESUME_DOCUMENT_SCHEMA_VERSION],
  fields: FIELDS,
  // Observations about what this template does, not claims about what any named
  // product accepts.
  complianceNotes: [
    "Section headings sit in a column beside the section instead of above it, so a reader that goes by position takes the heading and the first line together. That is the order they are written in.",
    "The two columns are a grid one section deep, not a flowing column count: no paragraph is ever split down the page and picked up again at the top.",
    "Dates print in the running text after the role and the place, rather than out at the right margin where an extractor has to guess what they belong to.",
    "Headings are ordinary text, never images or table cells.",
    "Every contact prints its own value, so a linked address survives being read as plain text.",
    "A field prints its label, a colon and its value, so the pair survives extraction.",
    "No tables, no text inside an image, and no font this document has to fetch.",
  ],
  styles,
  render,
});
