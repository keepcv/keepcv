import { strFromU8, unzipSync } from "fflate";
import type { DocumentLine } from "../lines.js";

const PARAGRAPH = /<w:p[ >][\s\S]*?<\/w:p>/g;
const RUN_TEXT = /<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g;
const STYLE = /<w:pStyle w:val="([^"]*)"/;
const LISTED = /<w:numPr>/;
const BOLD = /<w:b\s*\/>|<w:b [^>]*\/>/;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&(amp|lt|gt|quot|apos);/g, (whole) => ENTITIES[whole] ?? whole);
}

// A break and a tab are whitespace in the markup and nothing in the text, so
// without this two runs either side of one become a single joined word.
function textOf(paragraph: string): string {
  const spaced = paragraph.replace(/<w:(?:br|tab|cr)\s*\/>/g, "<w:t> </w:t>");
  const parts: string[] = [];
  for (const match of spaced.matchAll(RUN_TEXT)) parts.push(match[1] ?? "");
  return decode(parts.join("")).replace(/\s+/g, " ").trim();
}

const headingLevel = (paragraph: string): number | undefined => {
  const level = /^Heading([1-6])$/i.exec(STYLE.exec(paragraph)?.[1] ?? "")?.[1];
  return level === undefined ? undefined : Number(level);
};

// Reading `Title` as a heading files the document under the person's own name.
// `section` is the shallowest level used, so Heading2 is a section only when
// nothing is a Heading1.
function emphasisOf(
  paragraph: string,
  text: string,
  section: number | undefined,
): DocumentLine["emphasis"] {
  const style = STYLE.exec(paragraph)?.[1] ?? "";
  const level = headingLevel(paragraph);
  if (level !== undefined) return level === section ? "heading" : "strong";
  if (/^(Title|Subtitle)$/i.test(style)) return "strong";
  // Bold anywhere in the paragraph, which is how an entry head is set when the
  // template gave it no style of its own.
  return BOLD.test(paragraph) && text.length < 80 ? "strong" : "normal";
}

export class NotADocxError extends Error {}

// A DOCX is a zip, and the only part worth reading is the body. Styles, themes
// and numbering definitions say how it looked, not what it said.
export function docxLines(data: Uint8Array): DocumentLine[] {
  let body: string;
  try {
    const files = unzipSync(data, { filter: (file) => file.name === "word/document.xml" });
    const found = files["word/document.xml"];
    if (found === undefined) throw new NotADocxError("That file has no Word document inside it.");
    body = strFromU8(found);
  } catch (error) {
    if (error instanceof NotADocxError) throw error;
    throw new NotADocxError("That file is not a Word document this build can read.");
  }

  const paragraphs = [...body.matchAll(PARAGRAPH)].map((match) => match[0]);
  const levels = paragraphs.map(headingLevel).filter((level) => level !== undefined);
  const section = levels.length === 0 ? undefined : Math.min(...levels);

  const lines: DocumentLine[] = [];
  for (const paragraph of paragraphs) {
    const text = textOf(paragraph);
    if (text === "") continue;
    lines.push({
      text,
      emphasis: emphasisOf(paragraph, text, section),
      listed: LISTED.test(paragraph),
      column: 0,
      page: 1,
    });
  }
  return lines;
}
