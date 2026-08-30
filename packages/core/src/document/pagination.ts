import type { ResumeDocument } from "@keepcv/schema";

// Measurements arrive as fractional pixels, and a block ending a hair past the
// limit is a rounding artefact rather than a page break.
const EPSILON = 0.5;

// `atomic` is `break-inside: avoid` and `keepWithNext` is `break-after: avoid`,
// read from the template's own stylesheet rather than declared a second time.
export interface FlowBlock {
  key: string;
  top: number;
  height: number;
  atomic: boolean;
  keepWithNext: boolean;
  covers: readonly string[];
}

export interface Pagination {
  pages: number;
  pageOf: Readonly<Record<string, number>>;
  // Offsets into the unbroken column where a page starts, so a caller drawing
  // the boundaries does not have to re-run the fill.
  breaks: readonly number[];
}

// How far the page cursor must reach for this block to count as placed: a block
// that may not end a page is measured together with the one after it.
function reachOf(block: FlowBlock, next: FlowBlock | undefined): number {
  return block.keepWithNext && next !== undefined
    ? next.top + next.height - block.top
    : block.height;
}

// Fills pages from the unbroken column the template laid out, which is what the
// preview shows and the printer would fragment. An atomic block that will not
// fit in what is left moves whole, and everything after it shifts with it.
export function paginate(blocks: readonly FlowBlock[], usable: number): Pagination {
  const pageOf: Record<string, number> = {};
  const breaks: number[] = [];
  let page = 1;
  let pageTop = 0;
  let shift = 0;

  if (usable <= 0) return { pages: 1, pageOf, breaks };

  const turn = () => {
    page += 1;
    pageTop += usable;
    breaks.push(pageTop - shift);
  };

  for (const [index, block] of blocks.entries()) {
    const reach = reachOf(block, blocks[index + 1]);
    let top = block.top + shift;

    while (top > pageTop + usable - EPSILON) turn();

    // A block taller than a page cannot be rescued by moving it.
    if (
      block.atomic &&
      top > pageTop + EPSILON &&
      top + reach > pageTop + usable + EPSILON &&
      reach <= usable + EPSILON
    ) {
      shift += pageTop + usable - top;
      turn();
      top = block.top + shift;
    }

    for (const key of [block.key, ...block.covers]) pageOf[key] = page;

    // A block that may be broken straddles rather than moving, so the cursor
    // walks past every boundary its own height crosses.
    while (top + block.height > pageTop + usable + EPSILON) turn();
  }

  return { pages: page, pageOf, breaks };
}

export interface OverPiece {
  key: string;
  kind: "section" | "entry" | "point";
  label: string;
  page: number;
}

export interface LengthBudget {
  pages: number;
  limit: number | null;
  fits: boolean;
  over: readonly OverPiece[];
}

function labelled(
  pieces: OverPiece[],
  pageOf: Readonly<Record<string, number>>,
  limit: number,
  piece: Omit<OverPiece, "page">,
): boolean {
  const page = pageOf[piece.key];
  if (page === undefined || page <= limit) return false;
  pieces.push({ ...piece, page });
  return true;
}

// What the document costs and what sits past what the resume asked for. A
// section counted as over does not stop its entries being counted too: the
// answer is what to drop, and dropping the whole section is one of the choices.
export function lengthBudget(
  document: ResumeDocument,
  pagination: Pagination,
  limit: number | null,
): LengthBudget {
  const over: OverPiece[] = [];
  if (limit !== null) {
    for (const section of document.sections) {
      labelled(over, pagination.pageOf, limit, {
        key: section.key,
        kind: "section",
        label: section.heading,
      });
      for (const entry of section.entries) {
        labelled(over, pagination.pageOf, limit, {
          key: entry.key,
          kind: "entry",
          label: entry.title ?? entry.subtitle ?? entry.kind,
        });
        for (const point of entry.points) {
          labelled(over, pagination.pageOf, limit, {
            key: point.key,
            kind: "point",
            label: point.plainText,
          });
        }
      }
    }
  }

  return {
    pages: pagination.pages,
    limit,
    fits: limit === null || pagination.pages <= limit,
    over,
  };
}
