import type { ConfigField, ConfigOf } from "../contract.js";

export const FIELDS = [
  {
    key: "pageSize",
    label: "Page size",
    kind: "choice",
    options: [
      { value: "a4", label: "A4" },
      { value: "letter", label: "US Letter" },
    ],
    default: "a4",
  },
  {
    key: "fontFamily",
    label: "Typeface",
    kind: "choice",
    options: [
      { value: "arial", label: "Arial" },
      { value: "calibri", label: "Calibri" },
      { value: "georgia", label: "Georgia" },
      { value: "times", label: "Times New Roman" },
    ],
    default: "arial",
  },
  {
    key: "headings",
    label: "Section headings",
    kind: "choice",
    options: [
      { value: "uppercase", label: "Upper case" },
      { value: "as-written", label: "As written" },
    ],
    default: "uppercase",
  },
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

export type AtsConfig = ConfigOf<typeof FIELDS>;
