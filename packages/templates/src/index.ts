export { atsLeftHeading, atsSingleColumn, BLANK_SPEC } from "./built-in.js";
export {
  type ConfigField,
  type ConfigOf,
  type ConfigOption,
  type ConfigValue,
  configFor,
  configOf,
  defaultsOf,
  type Template,
  type TemplateConfig,
  withDefaults,
} from "./contract.js";
export { FIXTURE_DOCUMENT } from "./fixture.js";
export { fromSpec } from "./from-spec.js";
export { HTML_TEMPLATES } from "./html/built-in.js";
export { HtmlTemplateError } from "./html/error.js";
export { htmlScope, renderHtmlBody, validateHtmlTemplate } from "./html/template.js";
export { DESIGN_KNOBS, FIT_KNOBS, KNOBS } from "./knobs.js";
// Every renderer over a document owes these, not just a print template:
// escaping a mark, keying an element, and printing a field as `label: value`.
export { Field, Fields, joined, Links, Marks, Points } from "./prose.js";
export {
  DEFAULT_TEMPLATE_ID,
  resolveTemplate,
  TEMPLATES,
  templateById,
  templateOf,
} from "./registry.js";
export { accentOf } from "./styles.js";
export {
  definitionOf,
  fromDefinition,
  TEMPLATE_TYPES,
  type TemplateType,
  validateTemplate,
  visualSpecOf,
} from "./types.js";
