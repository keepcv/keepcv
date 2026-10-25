import { type ConfigField, type ConfigOf, configOf, type TemplateConfig } from "./contract.js";
import { FONT_FAMILY_FIELD, PAGE_SIZE_FIELD } from "./paper.js";

export const FIT_KNOBS = [
  PAGE_SIZE_FIELD,
  FONT_FAMILY_FIELD,
  {
    key: "fontSize",
    label: "Body size",
    kind: "number",
    min: 9,
    max: 12,
    step: 0.5,
    unit: "pt",
    default: 10.5,
  },
  {
    key: "lineHeight",
    label: "Line height",
    kind: "number",
    min: 1.1,
    max: 1.7,
    step: 0.05,
    unit: "x",
    default: 1.35,
  },
  {
    key: "margin",
    label: "Page margin",
    kind: "number",
    min: 10,
    max: 30,
    step: 1,
    unit: "mm",
    default: 18,
  },
  {
    key: "sectionGap",
    label: "Space between sections",
    kind: "number",
    min: 6,
    max: 20,
    step: 1,
    unit: "pt",
    default: 12,
  },
] as const satisfies readonly ConfigField[];

export const DESIGN_KNOBS = [
  {
    key: "accentColor",
    label: "Custom accent",
    kind: "color",
    default: "",
  },
  {
    key: "accent",
    label: "Accent",
    kind: "choice",
    options: [
      { value: "ink", label: "Ink" },
      { value: "slate", label: "Slate" },
      { value: "navy", label: "Navy" },
      { value: "burgundy", label: "Burgundy" },
      { value: "forest", label: "Forest" },
    ],
    default: "ink",
  },
  {
    key: "nameSize",
    label: "Name size",
    kind: "number",
    min: 1.4,
    max: 2.6,
    step: 0.05,
    unit: "x",
    default: 1.85,
  },
  {
    key: "headerAlign",
    label: "Header",
    kind: "choice",
    options: [
      { value: "left", label: "Left" },
      { value: "centre", label: "Centred" },
    ],
    default: "left",
  },
  {
    key: "headerRule",
    label: "Rule under the header",
    kind: "choice",
    options: [
      { value: "under", label: "Yes" },
      { value: "none", label: "No" },
    ],
    default: "under",
  },
  {
    key: "headingPlace",
    label: "Section headings",
    kind: "choice",
    options: [
      { value: "above", label: "Above the section" },
      { value: "beside", label: "In a column beside it" },
    ],
    default: "above",
  },
  {
    key: "headingWidth",
    label: "Heading column",
    kind: "number",
    min: 22,
    max: 48,
    step: 1,
    unit: "mm",
    default: 34,
  },
  {
    key: "headingCase",
    label: "Heading case",
    kind: "choice",
    options: [
      { value: "upper", label: "Upper case" },
      { value: "as-written", label: "As written" },
    ],
    default: "upper",
  },
  {
    key: "headingAlign",
    label: "Heading alignment",
    kind: "choice",
    options: [
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
    ],
    default: "left",
  },
  {
    key: "headingRule",
    label: "Heading rule",
    kind: "choice",
    options: [
      { value: "under-heading", label: "Under the heading" },
      { value: "over-section", label: "Above the section" },
      { value: "none", label: "None" },
    ],
    default: "under-heading",
  },
  {
    key: "entryMeta",
    label: "Dates and places",
    kind: "choice",
    options: [
      { value: "trailing", label: "Dates at the right margin" },
      { value: "inline", label: "Run on after the title" },
    ],
    default: "trailing",
  },
  {
    key: "headingSize",
    label: "Heading size",
    kind: "number",
    min: 0.8,
    max: 1.4,
    step: 0.05,
    unit: "x",
    default: 0.9,
  },
  {
    key: "entryGap",
    label: "Space between entries",
    kind: "number",
    min: 2,
    max: 14,
    step: 0.5,
    unit: "pt",
    default: 5,
  },
  {
    key: "pointGap",
    label: "Space between points",
    kind: "number",
    min: 0,
    max: 8,
    step: 0.5,
    unit: "pt",
    default: 1.5,
  },
  {
    key: "bullet",
    label: "Point marker",
    kind: "choice",
    options: [
      { value: "dash", label: "Dash" },
      { value: "disc", label: "Disc" },
      { value: "none", label: "None" },
    ],
    default: "dash",
  },
] as const satisfies readonly ConfigField[];

export const KNOBS: readonly ConfigField[] = [...FIT_KNOBS, ...DESIGN_KNOBS];

// A concatenated knob tuple ran the type-aware lint pass out of memory.
export type Design = ConfigOf<typeof FIT_KNOBS> & ConfigOf<typeof DESIGN_KNOBS>;

export function designOf(config: TemplateConfig): Design {
  return { ...configOf(FIT_KNOBS, config), ...configOf(DESIGN_KNOBS, config) };
}
