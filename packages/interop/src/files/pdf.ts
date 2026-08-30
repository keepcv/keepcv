import type { DocumentLine } from "../lines.js";
import { looksListed } from "../lines.js";

interface Piece {
  text: string;
  x: number;
  y: number;
  size: number;
  font: string;
  page: number;
}

export class NotAPdfError extends Error {}

// Same baseline within a point, which is what a superscript or a slightly
// different font size inside one line comes out as.
const SAME_LINE = 1.5;

// No glyph widths here, so the end of a piece is estimated. It only has to be
// good enough to tell a word space from the gutter between two columns.
const endOf = (piece: Piece): number => piece.x + piece.size * 0.5 * piece.text.length;

// A gap this much wider than the type is a gutter, not a space. Two headings
// set at the same height in two columns are one row and two lines, and joining
// them puts every entry of the right column under the left one's heading.
const GUTTER = 3;

function grouped(pieces: readonly Piece[]): Piece[][] {
  const rows: Piece[][] = [];
  for (const piece of pieces) {
    const row = rows.find(
      (each) =>
        each[0] !== undefined &&
        each[0].page === piece.page &&
        Math.abs(each[0].y - piece.y) <= SAME_LINE,
    );
    if (row === undefined) rows.push([piece]);
    else row.push(piece);
  }

  return rows.flatMap((row) => {
    const ordered = [...row].sort((a, b) => a.x - b.x);
    const runs: Piece[][] = [];
    for (const piece of ordered) {
      const last = runs.at(-1);
      const previous = last?.at(-1);
      if (last === undefined || previous === undefined) runs.push([piece]);
      else if (piece.x - endOf(previous) > previous.size * GUTTER) runs.push([piece]);
      else last.push(piece);
    }
    return runs;
  });
}

// One column unless there is a real gap with content either side of it. A
// resume set in two columns reads as nonsense top-to-bottom, and a template
// that merely indents its bullets is not two columns.
function columnAt(x: number, split: number | undefined): number {
  return split !== undefined && x >= split ? 1 : 0;
}

const baseline = (row: readonly Piece[]): string =>
  `${String(row[0]?.page ?? 1)}:${String(Math.round(row[0]?.y ?? 0))}`;

// What tells a column from a right-aligned date is whether anything shares the
// baseline: a column runs down the page alone, a date never does.
function splitPoint(rows: readonly Piece[][], width: number): number | undefined {
  const middle = width / 2;
  const onTheLeft = new Set(
    rows.filter((row) => (row[0]?.x ?? 0) < middle).map((row) => baseline(row)),
  );

  const alone = rows.filter((row) => (row[0]?.x ?? 0) >= middle && !onTheLeft.has(baseline(row)));
  if (onTheLeft.size < 3 || alone.length < 3) return undefined;

  return Math.min(...alone.map((row) => row[0]?.x ?? 0));
}

// Most gutters are not columns: a date or location set hard right is part of
// the line. Only runs in a column of their own stay split; the rest go back
// together.
function rejoined(runs: readonly Piece[][], split: number | undefined): Piece[][] {
  const rows = new Map<string, Piece[]>();
  for (const run of runs) {
    const at = run[0];
    if (at === undefined) continue;
    const key = `${baseline(run)}:${String(columnAt(at.x, split))}`;
    const held = rows.get(key);
    if (held === undefined) rows.set(key, [...run]);
    else held.push(...run);
  }
  return [...rows.values()];
}

// The font the body is set in, by how much text it carries. A heading is then
// anything bigger than it, or set in a different font at the same size.
function bodyFont(rows: readonly Piece[][]): { size: number; font: string } {
  const weight = new Map<string, { size: number; font: string; chars: number }>();
  for (const row of rows) {
    for (const piece of row) {
      const key = `${String(Math.round(piece.size))}:${piece.font}`;
      const held = weight.get(key) ?? { size: piece.size, font: piece.font, chars: 0 };
      held.chars += piece.text.length;
      weight.set(key, held);
    }
  }
  const heaviest = [...weight.values()].sort((a, b) => b.chars - a.chars)[0];
  return heaviest ?? { size: 10, font: "" };
}

function dominantFont(pieces: readonly Piece[]): string {
  const chars = new Map<string, number>();
  for (const piece of pieces) {
    chars.set(piece.font, (chars.get(piece.font) ?? 0) + piece.text.length);
  }
  return [...chars.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function lineOf(
  row: readonly Piece[],
  body: { size: number; font: string },
  split: number | undefined,
): DocumentLine {
  const ordered = [...row].sort((a, b) => a.x - b.x);
  // A gutter becomes a separator rather than a space, so what the template set
  // hard right stays a part of its own and the segmenter can tell which part is
  // a date.
  const text = ordered
    .map((piece, index) => {
      const previous = ordered[index - 1];
      if (previous === undefined) return piece.text;
      const wide = piece.x - endOf(previous) > previous.size * GUTTER;
      return `${wide ? " | " : " "}${piece.text}`;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  const first = ordered[0];
  const size = Math.max(...ordered.map((piece) => piece.size));

  const bigger = size > body.size + 0.5;
  // The font most of the line is set in, not the first piece's: a bullet glyph
  // comes from a symbol font, which marked every bullet as an entry head.
  const different = Math.abs(size - body.size) <= 0.5 && dominantFont(ordered) !== body.font;

  return {
    text,
    // An entry head is a line, not a paragraph. Prose that merely opens with a
    // bold phrase would otherwise start a new record halfway through a point.
    emphasis: bigger ? "heading" : different && text.length <= 90 ? "strong" : "normal",
    listed: looksListed(text),
    column: columnAt(first?.x ?? 0, split),
    page: first?.page ?? 1,
  };
}

// Loaded here rather than at the top so the module can be imported without
// paying for a PDF engine until a PDF is actually chosen.
async function pdfjs() {
  return await import("pdfjs-dist/legacy/build/pdf.mjs");
}

interface TextItem {
  str?: string;
  transform?: number[];
  fontName?: string;
}

export async function pdfLines(data: Uint8Array): Promise<DocumentLine[]> {
  const { getDocument } = await pdfjs();

  let document: Awaited<ReturnType<typeof getDocument>["promise"]>;
  try {
    // `verbosity: 0` because a resume whose template embedded no font data
    // warns once per page and none of it is actionable here. Nothing is drawn,
    // so `disableFontFace` keeps it from building font faces it will not use.
    document = await getDocument({ data, verbosity: 0, disableFontFace: true }).promise;
  } catch {
    throw new NotAPdfError("That file is not a PDF this build can read.");
  }

  const pieces: Piece[] = [];
  let width = 612;
  for (let page = 1; page <= document.numPages; page += 1) {
    const read = await document.getPage(page);
    width = Math.max(width, read.getViewport({ scale: 1 }).width);
    const content = await read.getTextContent();
    for (const item of content.items as TextItem[]) {
      const text = item.str ?? "";
      if (text.trim() === "") continue;
      const transform = item.transform ?? [1, 0, 0, 1, 0, 0];
      pieces.push({
        text,
        x: transform[4] ?? 0,
        y: transform[5] ?? 0,
        size: Math.abs(transform[3] ?? transform[0] ?? 10),
        font: item.fontName ?? "",
        page,
      });
    }
  }

  const runs = grouped(pieces);
  const split = splitPoint(runs, width);
  const body = bodyFont(runs);
  const rows = rejoined(runs, split);

  // Reading order, which the content stream is not: a PDF may emit its text in
  // any order at all, and a two-column resume read top-to-bottom is nonsense.
  // Down the page is decreasing y, so that comparison is the other way round.
  const placed = rows
    .map((row) => ({ row, at: row[0] }))
    .filter((each) => each.at !== undefined)
    .sort((a, b) => {
      const first = a.at as Piece;
      const second = b.at as Piece;
      return (
        columnAt(first.x, split) - columnAt(second.x, split) ||
        first.page - second.page ||
        second.y - first.y
      );
    });

  const sized = placed
    .map((each) => ({
      line: lineOf(each.row, body, split),
      size: Math.max(...each.row.map((piece) => piece.size)),
    }))
    .filter((each) => each.line.text !== "");

  return demoted(sized);
}

// The size rule alone reads the name as a heading, filing every section under
// it. A heading size repeats; a name's is used once, at the top.
function demoted(sized: readonly { line: DocumentLine; size: number }[]): DocumentLine[] {
  const largest = Math.max(...sized.map((each) => each.size), 0);
  const atLargest = sized.filter((each) => each.size === largest);
  const alone = atLargest.length === 1 && sized[0]?.size === largest;

  return sized.map((each, index) =>
    alone && index === 0 ? { ...each.line, emphasis: "strong" } : each.line,
  );
}
