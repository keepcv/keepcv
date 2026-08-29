import type { ResumeDocument, RichText } from "@keepcv/schema";
import type { ResumeBlock } from "./blocks.js";
import { toBlocks } from "./blocks.js";

// Every character Typst reads as markup. A run holding none of them is written
// as itself, which is what keeps the file worth opening in an editor.
//
// `/` is in here for `//`, which starts a comment: without it the `https://` in
// a link swallows the rest of the line, closing brackets included.
const MARKUP = /[\\#$[\]*_`<>@/]/;

// Inside a string literal only these two mean anything, so a run that would
// otherwise change the markup is written as one and no character in a resume
// can reach the parser.
const quoted = (value: string): string => `"${value.replace(/[\\"]/g, "\\$&")}"`;

const text = (value: string): string => (MARKUP.test(value) ? `#text(${quoted(value)})` : value);

function runs(nodes: RichText): string {
  return nodes
    .map((node) => {
      if (node.t === "text") return text(node.v);
      if (node.t === "b") return `#strong[${runs(node.c)}]`;
      if (node.t === "i") return `#emph[${runs(node.c)}]`;
      return `#link(${quoted(node.href)})[${runs(node.c)}]`;
    })
    .join("");
}

// The look is set once at the top, so the body is content and a reader who
// wants a different resume edits these eight lines rather than the whole file.
const PREAMBLE = `#set page(paper: "a4", margin: 18mm)
#set text(size: 10.5pt)
#set par(justify: false, leading: 0.6em)
#set list(indent: 0pt, body-indent: 6pt, spacing: 0.5em)
#show heading.where(level: 2): it => block(
  above: 12pt, below: 6pt, width: 100%,
  stack(spacing: 3pt, upper(strong(it.body)), line(length: 100%, stroke: 0.4pt)),
)
`;

// An entry head puts its period on the far right, which is what `1fr` of empty
// space between the two does.
function line(one: ResumeBlock): string {
  const said = runs(one.text);

  if (one.role === "point") return `- ${said}`;
  if (one.role === "name") return `#align(center)[#text(size: 20pt, weight: "bold")[${said}]]`;
  if (one.role === "headline") return `#align(center)[${said}]`;
  if (one.role === "contacts") return `#align(center)[#text(size: 9pt)[${said}]]`;
  if (one.role === "heading") return `== ${said}`;
  if (one.role === "detail") return `#text(size: 9.5pt)[${said}]`;
  if (one.role === "note") return said;
  if (one.aside === undefined) return `#strong[${said}]`;
  return `#grid(columns: (1fr, auto), strong[${said}], text(size: 9.5pt)[${text(one.aside)}])`;
}

// A blank line between blocks, because two lines with nothing between them are
// one paragraph in Typst and a bullet run has to stay a single list.
export function toTypst(document: ResumeDocument): string {
  const body = toBlocks(document)
    .map((one) => ({ one, said: line(one) }))
    .map(({ one, said }, index, all) => {
      const next = all[index + 1]?.one;
      const runOn = one.role === "point" && next?.role === "point";
      return runOn ? said : `${said}\n`;
    })
    .join("\n");

  return `${PREAMBLE}\n${body}`;
}
