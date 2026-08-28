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
export { DESIGN_KNOBS, FIT_KNOBS, KNOBS } from "./knobs.js";
// Every renderer over a document owes these, not just a print template: escaping
// a mark, keying an element, and printing a field as `label: value`.
export { Field, Fields, joined, Links, Marks, Points } from "./prose.js";
export {
  DEFAULT_TEMPLATE_ID,
  resolveTemplate,
  TEMPLATES,
  templateById,
  templateOf,
} from "./registry.js";
