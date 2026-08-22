import type { LintIssue, LintRule, LintSeverity } from "./report.js";

interface Pattern {
  pattern: RegExp;
  severity: LintSeverity;
  where: string;
  detail: string;
}

// Static: what the template declares, not what a browser painted. A rule here
// answers "would this construct move the words", and the constructs below are
// the ones that do it every time.
function scan(html: string, patterns: readonly Pattern[]): LintIssue[] {
  return patterns
    .filter(({ pattern }) => pattern.test(html))
    .map(({ severity, where, detail }) => ({ severity, where, detail }));
}

const SWITCH_TEMPLATES = "Nothing in the resume fixes this; a different template does.";

const READING_ORDER: readonly Pattern[] = [
  {
    pattern: /column-count\s*:\s*[2-9]/,
    severity: "blocker",
    where: "Two columns",
    detail: `Text is extracted from a printed page by position, so a line that spans two columns comes back interleaved. ${SWITCH_TEMPLATES}`,
  },
  {
    pattern: /[;{\s]columns\s*:\s*[^;}]*[2-9]/,
    severity: "blocker",
    where: "Two columns",
    detail: `Text is extracted from a printed page by position, so a line that spans two columns comes back interleaved. ${SWITCH_TEMPLATES}`,
  },
  {
    pattern: /float\s*:\s*(?:left|right)/,
    severity: "blocker",
    where: "A floated box",
    detail: `A box taken out of the text flow lands beside the words it was written after, and comes back in the wrong place. ${SWITCH_TEMPLATES}`,
  },
  {
    pattern: /position\s*:\s*(?:absolute|fixed)/,
    severity: "blocker",
    where: "A positioned box",
    detail: `Placing a box by coordinate breaks the tie between where it sits in the file and where it prints. ${SWITCH_TEMPLATES}`,
  },
  {
    pattern: /flex-direction\s*:\s*(?:row|column)-reverse/,
    severity: "blocker",
    where: "Reversed boxes",
    detail: `The words print in the opposite order to the one they are written in, and the reader gets the printed one. ${SWITCH_TEMPLATES}`,
  },
  {
    pattern: /[;{\s]order\s*:\s*-?[1-9]/,
    severity: "blocker",
    where: "Reordered boxes",
    detail: `The words print in an order the file does not have, and the reader gets the printed one. ${SWITCH_TEMPLATES}`,
  },
  {
    pattern: /<table\b/i,
    severity: "warning",
    where: "A table",
    detail: `Some readers take a table cell by cell, which splits a line that was meant to be read across. ${SWITCH_TEMPLATES}`,
  },
];

// A string of punctuation is a bullet or a separator; one carrying a letter or a
// digit is a word that exists only in the stylesheet.
const GENERATED_WORDS = /content\s*:\s*(["'])[^"']*[A-Za-z0-9][^"']*\1/;

const TEXT_AS_IMAGE: readonly Pattern[] = [
  {
    pattern: /<img\b/i,
    severity: "blocker",
    where: "An image",
    detail: `Anything an image says is invisible to a reader that extracts text. ${SWITCH_TEMPLATES}`,
  },
  {
    pattern: /background(?:-image)?\s*:[^;}]*url\(/,
    severity: "blocker",
    where: "A painted background",
    detail: `A picture behind the text carries nothing a reader can extract, and can hide what is on top of it. ${SWITCH_TEMPLATES}`,
  },
  {
    pattern: /<svg\b/i,
    severity: "warning",
    where: "A drawn shape",
    detail: `An icon is harmless; a heading drawn as a shape is text nobody can extract. ${SWITCH_TEMPLATES}`,
  },
  {
    pattern: GENERATED_WORDS,
    severity: "warning",
    where: "A word from the stylesheet",
    detail: `Text that a stylesheet generates is not in the file, so it is missing from anything that reads the file rather than the page. ${SWITCH_TEMPLATES}`,
  },
];

export const OUTPUT_RULES: readonly LintRule[] = [
  { id: "reading-order", check: ({ html }) => scan(html, READING_ORDER) },
  { id: "text-as-image", check: ({ html }) => scan(html, TEXT_AS_IMAGE) },
];
