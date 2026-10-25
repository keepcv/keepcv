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

export const singleColumn = fromSpec("single-column-v2", "Single column", {
  settings: {
    fontFamily: "calibri",
    fontSize: 10.5,
    lineHeight: 1.4,
    margin: 18,
    sectionGap: 13,
    nameSize: 2.15,
    headingSize: 0.95,
    headingCase: "as-written",
    headingRule: "under-heading",
    entryGap: 7,
    pointGap: 2,
    bullet: "disc",
  },
  extraCss: "",
});

export const leftHeadings = fromSpec("left-headings-v2", "Left headings", {
  settings: {
    fontFamily: "calibri",
    accent: "navy",
    margin: 17,
    lineHeight: 1.35,
    sectionGap: 14,
    nameSize: 2.25,
    headerRule: "under",
    headingPlace: "beside",
    headingWidth: 30,
    headingSize: 0.9,
    headingCase: "as-written",
    headingAlign: "left",
    headingRule: "none",
    entryMeta: "inline",
    entryGap: 7,
    pointGap: 2,
    bullet: "disc",
  },
  extraCss: "",
});

export const classic = fromSpec("classic-v1", "Classic", {
  settings: {
    fontFamily: "georgia",
    fontSize: 10.5,
    lineHeight: 1.4,
    margin: 20,
    sectionGap: 14,
    nameSize: 2.2,
    headerAlign: "centre",
    headerRule: "none",
    headingCase: "upper",
    headingRule: "under-heading",
    entryGap: 7,
    pointGap: 2,
    bullet: "disc",
  },
  extraCss: "",
});

export const modern = fromSpec("modern-v1", "Modern", {
  settings: {
    fontFamily: "calibri",
    accent: "navy",
    fontSize: 11,
    lineHeight: 1.4,
    margin: 19,
    sectionGap: 15,
    nameSize: 2.5,
    headerRule: "under",
    headingCase: "as-written",
    headingSize: 1.1,
    headingRule: "none",
    entryMeta: "trailing",
    entryGap: 8,
    pointGap: 2.5,
    bullet: "disc",
  },
  extraCss: "",
});

export const compact = fromSpec("compact-v1", "Compact", {
  settings: {
    fontFamily: "arial",
    fontSize: 9.5,
    lineHeight: 1.25,
    margin: 14,
    sectionGap: 8,
    nameSize: 1.7,
    headerRule: "none",
    headingCase: "upper",
    headingRule: "under-heading",
    entryGap: 3,
    pointGap: 1,
    bullet: "dash",
  },
  extraCss: "",
});

export const editorial = fromSpec("editorial-v1", "Editorial", {
  settings: {
    fontFamily: "georgia",
    accent: "burgundy",
    fontSize: 10.5,
    lineHeight: 1.45,
    margin: 18,
    sectionGap: 14,
    nameSize: 2.3,
    headerRule: "none",
    headingPlace: "beside",
    headingWidth: 32,
    headingCase: "as-written",
    headingSize: 1,
    headingAlign: "right",
    headingRule: "over-section",
    entryMeta: "inline",
    entryGap: 7,
    pointGap: 2,
    bullet: "none",
  },
  extraCss: "",
});

export const BLANK_SPEC: TemplateSpec = { settings: {}, extraCss: "" };
