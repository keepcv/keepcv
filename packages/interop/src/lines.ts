// What both a PDF and a DOCX can say about one line, and all the segmenter is
// allowed to know. A DOCX names its headings and its lists; a PDF has neither,
// so the extractor there works them out from size, font and the leading glyph.
export interface DocumentLine {
  text: string;
  emphasis: "heading" | "strong" | "normal";
  listed: boolean;
  // Reading order across a two-column layout: everything in column 0, then
  // everything in column 1. Always 0 for a DOCX.
  column: number;
  page: number;
}

// Escaped rather than written out: the source stays ASCII, and these are the
// glyphs a resume template actually emits in front of a bullet.
const BULLETS = /^[\u2022\u2023\u25aa\u25cf\u00b7*\-\u2013\u2014]\s+/;

export const withoutBullet = (text: string): string => text.replace(BULLETS, "").trim();

export const looksListed = (text: string): boolean => BULLETS.test(text);

// Short, and not a sentence. All caps is the strongest signal a PDF gives,
// because a heading and the name at the top are often set at the same size.
export function looksLikeHeading(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 40) return false;
  if (/[.!?]$/.test(trimmed)) return false;
  const letters = trimmed.replace(/[^a-z]/gi, "");
  return letters.length > 1 && letters === letters.toUpperCase();
}
