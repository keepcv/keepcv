import { configOf, type TemplateConfig } from "../contract.js";
import { pageRule, STACKS } from "../paper.js";
import { FIELDS } from "./config.js";

// Grid rather than a float or a coordinate: those move the words away from the
// order the markup has them in, and the lint rules refuse all three.
export function styles(config: TemplateConfig): string {
  const {
    fontFamily,
    fontSize,
    headingAlign,
    headingWidth,
    lineHeight,
    margin,
    sectionGap,
    pageSize,
  } = configOf(FIELDS, config);

  return `
${pageRule(pageSize, margin)}

.kc-doc {
  font-family: ${STACKS[fontFamily]};
  font-size: ${fontSize}pt;
  line-height: ${lineHeight};
  color: #101418;
  orphans: 2;
  widows: 2;
}
.kc-doc * { margin: 0; padding: 0; box-sizing: border-box; }
.kc-doc a { color: inherit; text-decoration: underline; text-underline-offset: 1.5pt; }
.kc-doc ul { list-style: none; }

.kc-header { padding-bottom: ${sectionGap}pt; break-inside: avoid; }
.kc-name { font-size: 2.1em; font-weight: 700; letter-spacing: -0.015em; line-height: 1.05; }
.kc-headline { margin-top: 2.5pt; color: #374151; }
.kc-contacts { display: flex; flex-wrap: wrap; margin-top: 4pt; }
.kc-contacts li + li::before { content: "  |  "; white-space: pre; }
.kc-summary { margin-top: 5pt; }

.kc-section {
  display: grid;
  grid-template-columns: ${headingWidth}mm minmax(0, 1fr);
  column-gap: 6mm;
  border-top: 0.6pt solid #9ca3af;
  padding-top: ${sectionGap}pt;
  margin-top: ${sectionGap}pt;
}
.kc-section > :not(.kc-heading) { grid-column: 2; }
.kc-heading {
  grid-column: 1;
  grid-row: 1;
  align-self: start;
  font-size: 0.86em;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: ${headingAlign};
  break-after: avoid;
}
.kc-empty { color: #6b7280; font-style: italic; }

.kc-group { margin-bottom: 7pt; }
.kc-group > .kc-entry { margin-top: 4pt; margin-bottom: 0; }
.kc-entry { margin-bottom: 6pt; break-inside: avoid; }
.kc-section > :last-child { margin-bottom: 0; }

.kc-title { font-weight: 700; }
.kc-meta { color: #374151; font-variant-numeric: tabular-nums; }

.kc-points { margin-top: 2.5pt; }
.kc-points li { padding-left: 1.1em; text-indent: -1.1em; margin-top: 1.5pt; }
.kc-points li::before { content: "- "; }
.kc-metrics { color: #374151; }
.kc-fields li, .kc-links { margin-top: 1.5pt; color: #374151; }
.kc-label { font-weight: 700; }
`.trim();
}
