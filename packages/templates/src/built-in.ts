import type { TemplateSpec } from "@keepcv/schema";
import { fromSpec } from "./from-spec.js";

export const atsSingleColumn = fromSpec("ats-single-column", "Single column", {
  settings: {
    margin: 18,
    sectionGap: 12,
    nameSize: 1.85,
    headerRule: "under",
    headingPlace: "above",
    headingRule: "under-heading",
    entryMeta: "trailing",
  },
  extraCss: "",
});

export const atsLeftHeading = fromSpec("ats-left-heading", "Left headings", {
  settings: {
    margin: 16,
    lineHeight: 1.4,
    sectionGap: 11,
    nameSize: 2.1,
    headerRule: "none",
    headingPlace: "beside",
    headingAlign: "right",
    headingRule: "over-section",
    entryMeta: "inline",
  },
  extraCss: "",
});

// What a template the user starts from scratch begins as, and what the editor
// resets to. Every knob at the catalogue's own default.
export const BLANK_SPEC: TemplateSpec = { settings: {}, extraCss: "" };
