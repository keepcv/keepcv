import type { ConfigField } from "./contract.js";

export const PAGE_SIZE_FIELD = {
  key: "pageSize",
  label: "Page size",
  kind: "choice",
  options: [
    { value: "a4", label: "A4" },
    { value: "letter", label: "US Letter" },
  ],
  default: "a4",
} as const satisfies ConfigField;

export const FONT_FAMILY_FIELD = {
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
} as const satisfies ConfigField;

type PageSize = (typeof PAGE_SIZE_FIELD)["options"][number]["value"];
type FontFamily = (typeof FONT_FAMILY_FIELD)["options"][number]["value"];

// Keyed by the values the field above declares, so a typeface added to the
// picker without a stack here is a compile error.
export const STACKS: Record<FontFamily, string> = {
  arial: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
  calibri: "Calibri, Carlito, 'Segoe UI', sans-serif",
  georgia: "Georgia, 'Times New Roman', Times, serif",
  times: "'Times New Roman', Times, serif",
};

const PAGES: Record<PageSize, { name: string; width: string; height: number }> = {
  a4: { name: "A4", width: "210mm", height: 297 },
  letter: { name: "Letter", width: "215.9mm", height: 279.4 },
};

// Physical units, so the preview and the printed page are one measurement. A
// second copy of `--kc-page-content-height` drifts into a wrong page count.
export function pageRule(pageSize: PageSize, margin: number): string {
  const page = PAGES[pageSize];

  return `
@page { size: ${page.name}; margin: ${margin}mm; }

:root { --kc-page-content-height: ${String(page.height - margin * 2)}mm; }

.kc-page {
  width: ${page.width};
  min-height: ${String(page.height)}mm;
  padding: ${margin}mm;
  background: #fff;
}

@media print {
  .kc-page { width: auto; min-height: 0; padding: 0; }
}
`.trim();
}
