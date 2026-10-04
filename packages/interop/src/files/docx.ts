import { strFromU8, Unzip, UnzipInflate } from "fflate";
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

// Dropping a break or tab joins the words from adjacent runs.
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

// Reading `Title` as a heading files records under the person's own name.
function emphasisOf(
  paragraph: string,
  text: string,
  section: number | undefined,
): DocumentLine["emphasis"] {
  const style = STYLE.exec(paragraph)?.[1] ?? "";
  const level = headingLevel(paragraph);
  if (level !== undefined) return level === section ? "heading" : "strong";
  if (/^(Title|Subtitle)$/i.test(style)) return "strong";
  return BOLD.test(paragraph) && text.length < 80 ? "strong" : "normal";
}

export class NotADocxError extends Error {}

export function docxLines(data: Uint8Array, maxXmlBytes = 4 * 1024 * 1024): DocumentLine[] {
  let body: string;
  try {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    const state = { complete: false, found: false };
    let entries = 0;
    const unzip = new Unzip((file) => {
      if (++entries > 512)
        throw new NotADocxError("That Word document contains too many ZIP entries.");
      if (file.name !== "word/document.xml") return;
      if (state.found)
        throw new NotADocxError("That file contains more than one Word document body.");
      state.found = true;
      if ((file.originalSize ?? 0) > maxXmlBytes) {
        throw new NotADocxError("That Word document expands beyond the text size limit.");
      }
      file.ondata = (error, chunk, final) => {
        if (error) throw error;
        bytes += chunk.byteLength;
        if (bytes > maxXmlBytes)
          throw new NotADocxError("That Word document expands beyond the text size limit.");
        chunks.push(chunk);
        state.complete = final;
      };
      file.start();
    });
    unzip.register(UnzipInflate);
    for (let at = 0; at < data.length; at += 1024) {
      unzip.push(data.subarray(at, at + 1024), at + 1024 >= data.length);
    }
    if (!state.found || !state.complete)
      throw new NotADocxError("That file has no complete Word document inside it.");
    const text = new Uint8Array(bytes);
    let at = 0;
    for (const chunk of chunks) {
      text.set(chunk, at);
      at += chunk.length;
    }
    body = strFromU8(text);
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
