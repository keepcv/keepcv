import { RESUME_DOCUMENT_SCHEMA_VERSION } from "@keepcv/schema";
import { defineTemplate } from "../contract.js";
import { FIELDS } from "./config.js";
import { render } from "./render.js";
import { styles } from "./styles.js";

export const atsSingleColumn = defineTemplate({
  id: "ats-single-column",
  name: "Single column",
  version: "1.0.0",
  documentVersions: [RESUME_DOCUMENT_SCHEMA_VERSION],
  fields: FIELDS,
  // Observations about what this template does, not claims about what any
  // named product accepts (template-model.md #5).
  complianceNotes: [
    "One column: the page prints in the order the markup reads, so an extractor recovers the same order.",
    "Headings are ordinary text at the top of each section, never images or table cells.",
    "Every contact prints its own value, so a linked address survives being read as plain text.",
    "A field prints its label, a colon and its value, so the pair survives extraction.",
    "Dates print as text beside the entry they belong to, formatted for the document locale.",
    "No tables, no columns, no text inside an image, and no font this document has to fetch.",
  ],
  styles,
  render,
});
