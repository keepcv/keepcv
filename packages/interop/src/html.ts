const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const decoded = (value: string): string =>
  value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return ENTITIES[lower] ?? whole;
  });

const tidy = (value: string): string => decoded(value).replace(/\s+/g, " ").trim();

export interface ReadHtml {
  summary: string | null;
  points: string[];
}

// Emphasis and inline links go: a point is plain text here, and the store has
// nowhere to put a bold run that came out of somebody else's editor.
const CLOSES_A_BLOCK = /^<\/(?:p|h[1-6]|div|blockquote)>$/i;

interface Reading {
  paragraphs: string[];
  points: string[];
  held: string;
  listed: number;
}

function flush(reading: Reading, into: string[]): void {
  const found = tidy(reading.held);
  reading.held = "";
  if (found !== "") into.push(found);
}

const open = (reading: Reading): string[] =>
  reading.listed > 0 ? reading.points : reading.paragraphs;

function take(reading: Reading, token: string): void {
  if (!token.startsWith("<")) {
    reading.held += token;
    return;
  }
  // A nested list flushes the item holding it, so a bullet under a bullet
  // arrives as its own point rather than running into its parent's text.
  if (/^<li\b/i.test(token)) {
    flush(reading, open(reading));
    reading.listed += 1;
    return;
  }
  if (/^<\/li>$/i.test(token)) {
    flush(reading, reading.points);
    reading.listed = Math.max(0, reading.listed - 1);
    return;
  }
  if (CLOSES_A_BLOCK.test(token)) {
    if (reading.listed > 0) reading.held += " ";
    else flush(reading, reading.paragraphs);
    return;
  }
  if (/^<br\b/i.test(token)) reading.held += " ";
}

// Paragraphs become the summary and list items become points. Written out
// rather than parsed with a DOM, because this package runs where there is no
// document.
export function readHtml(html: string): ReadHtml {
  const reading: Reading = { paragraphs: [], points: [], held: "", listed: 0 };

  for (const token of html.split(/(<[^>]*>)/)) take(reading, token);
  flush(reading, open(reading));

  const { paragraphs, points } = reading;
  return { summary: paragraphs.length === 0 ? null : paragraphs.join("\n\n"), points };
}
