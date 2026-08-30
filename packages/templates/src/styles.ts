import type { TemplateConfig } from "./contract.js";
import { type Design, designOf } from "./knobs.js";
import { pageRule, STACKS } from "./paper.js";

// Keyed by what the knob offers, so a colour added to the picker without a
// value here is a compile error.
const ACCENTS: Record<Design["accent"], string> = {
  ink: "#101418",
  slate: "#334155",
  navy: "#1e3a5f",
  burgundy: "#6b2137",
  forest: "#1f4d38",
};

// Grid, never a float or a coordinate - the lint rules refuse all three.
// `align-self`, or a stretched item reports its row's height to the paginator.
function sectionRule(design: Design): string {
  if (design.headingPlace !== "beside") return ".kc-section { display: block; }";

  return `
.kc-section {
  display: grid;
  grid-template-columns: ${String(design.headingWidth)}mm minmax(0, 1fr);
  column-gap: 6mm;
}
.kc-section > :not(.kc-heading) { grid-column: 2; }
.kc-heading { grid-column: 1; grid-row: 1; align-self: start; }
`.trim();
}

function headingRule(design: Design): string {
  if (design.headingRule === "under-heading") {
    return ".kc-heading { border-bottom: 0.6pt solid #6b7280; padding-bottom: 1.5pt; }";
  }
  if (design.headingRule === "over-section") {
    return `.kc-section { border-top: 0.6pt solid #9ca3af; padding-top: ${String(design.sectionGap)}pt; }`;
  }
  return "";
}

// A disc the browser draws, not one the stylesheet spells out: the lint rules
// refuse `content` carrying a digit, and a CSS escape for a bullet is four.
function bulletRule(design: Design): string {
  if (design.bullet === "disc") {
    return ".kc-points { list-style: disc outside; padding-left: 1.1em; }";
  }
  if (design.bullet === "none") return "";
  return `
.kc-points li { padding-left: 1.1em; text-indent: -1.1em; }
.kc-points li::before { content: "- "; }
`.trim();
}

export function stylesheet(config: TemplateConfig, extraCss: string): string {
  const design = designOf(config);
  const accent = ACCENTS[design.accent];
  const centred = design.headerAlign === "centre";

  return `
${pageRule(design.pageSize, design.margin)}

.kc-doc {
  font-family: ${STACKS[design.fontFamily]};
  font-size: ${String(design.fontSize)}pt;
  line-height: ${String(design.lineHeight)};
  color: #101418;
  orphans: 2;
  widows: 2;
}
.kc-doc * { margin: 0; padding: 0; box-sizing: border-box; }
.kc-doc a { color: inherit; text-decoration: underline; text-underline-offset: 1.5pt; }
.kc-doc ul { list-style: none; }

.kc-header {
  text-align: ${centred ? "center" : "left"};
  padding-bottom: ${String(design.sectionGap)}pt;
  break-inside: avoid;
  ${design.headerRule === "under" ? `border-bottom: 1.2pt solid ${accent};` : ""}
}
.kc-name {
  font-size: ${String(design.nameSize)}em;
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.05;
  color: ${accent};
}
.kc-headline { margin-top: 2.5pt; color: #374151; }
.kc-contacts {
  display: flex;
  flex-wrap: wrap;
  margin-top: 4pt;
  justify-content: ${centred ? "center" : "flex-start"};
}
.kc-contacts li + li::before { content: "  |  "; white-space: pre; }
.kc-summary { margin-top: 5pt; }

.kc-section { margin-top: ${String(design.sectionGap)}pt; }
${sectionRule(design)}
.kc-heading {
  font-size: 0.9em;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: ${design.headingCase === "upper" ? "uppercase" : "none"};
  text-align: ${design.headingAlign};
  color: ${accent};
  margin-bottom: 3pt;
  break-inside: avoid;
  break-after: avoid;
}
${headingRule(design)}
.kc-empty { color: #6b7280; font-style: italic; }

.kc-group { margin-top: 6pt; }
.kc-group > .kc-entry { margin-top: 3pt; }
.kc-entry { margin-top: 5pt; break-inside: avoid; }
.kc-row { display: flex; justify-content: space-between; align-items: baseline; gap: 2em; }
.kc-title { font-weight: 700; }
.kc-meta { color: #374151; font-variant-numeric: tabular-nums; }
.kc-row > .kc-meta { flex: none; }
.kc-sub { color: #374151; }

.kc-points { margin-top: 2.5pt; }
.kc-points li { margin-top: 1.5pt; }
${bulletRule(design)}
.kc-metrics { color: #374151; }
.kc-fields li, .kc-links { margin-top: 1.5pt; color: #374151; }
.kc-label { font-weight: 700; }
${extraCss}
`.trim();
}
