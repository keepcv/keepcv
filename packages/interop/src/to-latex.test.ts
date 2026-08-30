import type { ResumeDocument } from "@keepcv/schema";
import { FIXTURE_DOCUMENT } from "@keepcv/templates";
import { describe, expect, it } from "vitest";
import { escapeLatex, toLatex } from "./to-latex.js";

const TEX = toLatex(FIXTURE_DOCUMENT);

const withPoint = (text: ResumeDocument["sections"][number]["entries"][number]["points"][number]) =>
  ({
    ...FIXTURE_DOCUMENT,
    sections: [
      {
        key: "s0",
        kind: "experience" as const,
        heading: "Experience",
        layout: "entries" as const,
        entries: [
          { key: "e0", kind: "experience", points: [text], tags: [], links: [], fields: [] },
        ],
      },
    ],
  }) satisfies ResumeDocument;

describe("writing a resume as LaTeX", () => {
  it("is a document that stands on its own", () => {
    expect(TEX.startsWith("\\documentclass")).toBe(true);
    expect(TEX).toContain("\\begin{document}");
    expect(TEX.endsWith("\\end{document}\n")).toBe(true);
  });

  // Every one of these ships with a full TeX installation. A file that needs a
  // package the reader has to fetch first is a file that does not compile.
  it("loads nothing outside a standard installation", () => {
    const loaded = [...TEX.matchAll(/\\usepackage(?:\[[^\]]*\])?\{([^}]*)\}/g)].map(
      (match) => match[1],
    );
    expect(loaded.toSorted()).toEqual([
      "enumitem",
      "fontenc",
      "geometry",
      "hyperref",
      "inputenc",
      "lmodern",
      "parskip",
    ]);
  });

  // Without it T1 selects the EC bitmap fonts and the compiled PDF extracts
  // "Staff engineer" as "Sta engineer" - the ligature gone from text a machine
  // reads back. It has to be loaded before `fontenc` chooses the family.
  it("names a font family that survives being read back out of the PDF", () => {
    const order = ["lmodern", "fontenc"].map((one) => TEX.indexOf(`{${one}}`));

    expect(order.every((at) => at > 0)).toBe(true);
    expect(order[0]).toBeLessThan(order[1] ?? 0);
  });

  it("defines every command its body uses", () => {
    const defined = new Set(
      [...TEX.matchAll(/\\newcommand\{\\(kc[a-z]+)\}/g)].map((match) => match[1]),
    );
    const used = new Set([...TEX.matchAll(/^\\(kc[a-z]+)\{/gm)].map((match) => match[1]));

    expect(used.size).toBeGreaterThan(0);
    for (const command of used) expect(defined).toContain(command);
  });

  it("sets a run of points as one list rather than a list per point", () => {
    expect(TEX.match(/\\begin\{itemize\}/g)?.length).toBe(TEX.match(/\\end\{itemize\}/g)?.length);
    // Four entries in the fixture carry points; nothing opens a list twice.
    expect(TEX).not.toContain("\\end{itemize}\n\\begin{itemize}");
  });

  it("escapes every character TeX reads as syntax", () => {
    expect(escapeLatex("50% of $10 & #1 _x^y ~ {a} \\b")).toBe(
      "50\\% of \\$10 \\& \\#1 \\_x\\textasciicircum{}y \\textasciitilde{} \\{a\\} \\textbackslash{}b",
    );
  });

  it("carries a mark through as a command rather than dropping it", () => {
    expect(TEX).toContain("\\textbf{measurable}");
    expect(TEX).toContain("\\emph{large}");
    expect(TEX).toContain("\\href{mailto:ada@example.org}");
  });

  // A percent sign in a point would comment out the rest of the line, which is
  // a resume that silently loses a sentence rather than failing to build.
  it("does not let a point comment out the line it is on", () => {
    const written = toLatex(
      withPoint({
        key: "p0",
        text: [{ t: "text", v: "Cut cost 40% & held p99 under 100ms" }],
        plainText: "Cut cost 40% & held p99 under 100ms",
        metrics: [],
        tags: [],
      }),
    );

    expect(written).toContain("Cut cost 40\\% \\& held p99 under 100ms");
    for (const line of written.split("\n")) {
      expect(line.replace(/\\%/g, "")).not.toMatch(/(?<!\\)%/);
    }
  });

  it("leaves a url readable to hyperref", () => {
    const written = toLatex({
      ...FIXTURE_DOCUMENT,
      header: {
        ...FIXTURE_DOCUMENT.header,
        contacts: [
          { key: "c0", kind: "website", value: "site", href: "https://x.test/a_b?q=1&r=2#top" },
        ],
      },
    });

    expect(written).toContain("\\href{https://x.test/a_b?q=1&r=2\\#top}{site}");
  });
});
