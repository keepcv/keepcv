import type { ResumeDocument, RichText } from "@keepcv/schema";
import type { ResumeBlock } from "./blocks.js";
import { toBlocks } from "./blocks.js";

// The ten characters TeX reads as syntax. The last three have no `\x` form -
// backslash before any of them means something else - so each takes a command.
const SPECIAL: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  $: "\\$",
  "&": "\\&",
  "#": "\\#",
  "^": "\\textasciicircum{}",
  _: "\\_",
  "~": "\\textasciitilde{}",
  "%": "\\%",
};

export const escapeLatex = (value: string): string =>
  value.replace(/[\\{}$&#^_~%]/g, (character) => SPECIAL[character] ?? character);

// A URL is escaped by different rules to prose: `\url` reads its argument
// almost verbatim, and only the brace that would close it has to go.
const escapeUrl = (url: string): string => url.replace(/([\\{}%#])/g, "\\$1");

function runs(nodes: RichText): string {
  return nodes
    .map((node) => {
      if (node.t === "text") return escapeLatex(node.v);
      if (node.t === "b") return `\\textbf{${runs(node.c)}}`;
      if (node.t === "i") return `\\emph{${runs(node.c)}}`;
      return `\\href{${escapeUrl(node.href)}}{${runs(node.c)}}`;
    })
    .join("");
}

// Every command the body uses is defined here, so the body is a sequence of
// one-line calls and a reader who wants a different look edits the preamble.
// Nothing outside a full TeX Live installation's base is loaded: a file that
// needs a package the reader has to install is one that does not compile.
// `lmodern` before `fontenc`, or T1 selects the EC bitmap fonts, which carry no
// glyph names a reader can map back: the PDF prints "Staff engineer" and
// extracts as "Sta engineer", the ff and fi silently gone. Latin Modern is on
// any full installation, so this costs the body nothing.
const PREAMBLE = `\\documentclass[11pt,a4paper]{article}
\\usepackage{lmodern}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=18mm]{geometry}
\\usepackage{enumitem}
\\usepackage{parskip}
\\usepackage[hidelinks]{hyperref}

\\pagestyle{empty}
\\setlist[itemize]{leftmargin=*,topsep=2pt,itemsep=1pt,parsep=0pt}

\\newcommand{\\kcname}[1]{{\\LARGE\\bfseries #1}\\par\\vspace{2pt}}
\\newcommand{\\kcheadline}[1]{{#1}\\par}
\\newcommand{\\kccontacts}[1]{{\\small #1}\\par\\vspace{6pt}}
\\newcommand{\\kcheading}[1]{\\vspace{8pt}{\\large\\bfseries #1}\\par\\vspace{-4pt}\\rule{\\linewidth}{0.4pt}\\par\\vspace{2pt}}
\\newcommand{\\kcentry}[2]{\\vspace{4pt}\\noindent\\textbf{#1}\\hfill{\\small #2}\\par}
\\newcommand{\\kcdetail}[1]{{\\small #1}\\par}
\\newcommand{\\kcnote}[1]{{#1}\\par}
`;

// A run of points is one `itemize`, so the list is set as a list rather than as
// a paragraph per bullet, which is what a reader would otherwise get.
function body(blocks: readonly ResumeBlock[]): string {
  const lines: string[] = [];
  let listing = false;

  for (const one of blocks) {
    if (one.role === "point" && !listing) lines.push("\\begin{itemize}");
    if (one.role !== "point" && listing) lines.push("\\end{itemize}");
    listing = one.role === "point";

    const text = runs(one.text);
    if (one.role === "point") lines.push(`  \\item ${text}`);
    else if (one.role === "entry")
      lines.push(`\\kcentry{${text}}{${escapeLatex(one.aside ?? "")}}`);
    else lines.push(`\\kc${one.role}{${text}}`);
  }

  if (listing) lines.push("\\end{itemize}");
  return lines.join("\n");
}

export function toLatex(document: ResumeDocument): string {
  return `${PREAMBLE}\n\\begin{document}\n${body(toBlocks(document))}\n\\end{document}\n`;
}
