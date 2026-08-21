import { configOf, type TemplateConfig } from "../contract.js";
import type { AtsConfig } from "./config.js";
import { FIELDS } from "./config.js";

// Keyed by the option values `fontFamily` declares, so a typeface added to the
// picker without a stack here is a compile error.
const STACKS: Record<AtsConfig["fontFamily"], string> = {
  arial: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
  calibri: "Calibri, Carlito, 'Segoe UI', sans-serif",
  georgia: "Georgia, 'Times New Roman', Times, serif",
  times: "'Times New Roman', Times, serif",
};

const PAGES: Record<AtsConfig["pageSize"], { name: string; width: string; height: string }> = {
  a4: { name: "A4", width: "210mm", height: "297mm" },
  letter: { name: "Letter", width: "215.9mm", height: "279.4mm" },
};

// Physical units throughout, so the preview and the printed page are the same
// measurement. Fitting that on a screen is the host's job, not the template's.
export function styles(config: TemplateConfig): string {
  const { fontFamily, fontSize, headings, lineHeight, margin, sectionGap, pageSize } = configOf(
    FIELDS,
    config,
  );
  const page = PAGES[pageSize];

  return `
@page { size: ${page.name}; margin: ${margin}mm; }

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

.kc-page {
  width: ${page.width};
  min-height: ${page.height};
  padding: ${margin}mm;
  background: #fff;
}

.kc-name { font-size: 1.85em; font-weight: 700; letter-spacing: -0.01em; }
.kc-headline { margin-top: 1pt; }
.kc-contacts { display: flex; flex-wrap: wrap; margin-top: 3pt; }
.kc-contacts li + li::before { content: "  |  "; white-space: pre; }
.kc-summary { margin-top: 4pt; }
.kc-header { padding-bottom: 5pt; border-bottom: 1.2pt solid #101418; }

.kc-section { margin-top: ${sectionGap}pt; }
.kc-heading {
  font-size: 0.92em;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: ${headings === "uppercase" ? "uppercase" : "none"};
  border-bottom: 0.6pt solid #6b7280;
  padding-bottom: 1.5pt;
  margin-bottom: 3pt;
}
.kc-empty { color: #6b7280; font-style: italic; }

.kc-group { margin-top: 5pt; }
.kc-group > .kc-entry { margin-top: 3pt; }
.kc-entry { margin-top: 5pt; break-inside: avoid; }
.kc-row { display: flex; justify-content: space-between; align-items: baseline; gap: 2em; }
.kc-title { font-weight: 700; }
.kc-meta { flex: none; font-variant-numeric: tabular-nums; }
.kc-sub { color: #374151; }

.kc-points { margin-top: 2pt; }
.kc-points li { padding-left: 1.1em; text-indent: -1.1em; margin-top: 1.5pt; }
.kc-points li::before { content: "- "; }
.kc-metrics { color: #374151; }
.kc-fields li, .kc-links { margin-top: 1.5pt; color: #374151; }
.kc-label { font-weight: 700; }

@media print {
  .kc-page { width: auto; min-height: 0; padding: 0; }
}
`.trim();
}
