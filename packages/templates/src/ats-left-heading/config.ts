import type { ConfigField, ConfigOf } from "../contract.js";
import { FONT_FAMILY_FIELD, PAGE_SIZE_FIELD } from "../paper.js";

export const FIELDS = [
  PAGE_SIZE_FIELD,
  FONT_FAMILY_FIELD,
  {
    key: "headingAlign",
    label: "Headings sit",
    kind: "choice",
    options: [
      { value: "right", label: "Against the text" },
      { value: "left", label: "Against the margin" },
    ],
    default: "right",
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
    default: 1.4,
  },
  {
    key: "margin",
    label: "Page margin",
    kind: "number",
    min: 10,
    max: 30,
    step: 1,
    unit: "mm",
    default: 16,
  },
  {
    key: "sectionGap",
    label: "Space between sections",
    kind: "number",
    min: 6,
    max: 20,
    step: 1,
    unit: "pt",
    default: 11,
  },
] as const satisfies readonly ConfigField[];

export type LeftHeadingConfig = ConfigOf<typeof FIELDS>;
