import type { ResumeDocument } from "@keepcv/schema";
import { FIXTURE_DOCUMENT } from "@keepcv/templates";
import { describe, expect, it } from "vitest";
import { toTypst } from "./to-typst.js";

const TYP = toTypst(FIXTURE_DOCUMENT);

const onePoint = (value: string): ResumeDocument => ({
  ...FIXTURE_DOCUMENT,
  sections: [
    {
      key: "s0",
      kind: "experience",
      heading: "Experience",
      layout: "entries",
      entries: [
        {
          key: "e0",
          kind: "experience",
          title: "Engineer",
          points: [
            { key: "p0", text: [{ t: "text", v: value }], plainText: value, metrics: [], tags: [] },
          ],
          tags: [],
          links: [],
          fields: [],
        },
      ],
    },
  ],
});

// Every bracket a run opens has to close, or the file stops parsing partway
// through and takes the rest of the resume with it.
const balanced = (source: string): boolean => {
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === "[") depth += 1;
    if (character === "]") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
};

describe("writing a resume as Typst", () => {
  it("sets the page once, at the top", () => {
    expect(TYP.startsWith('#set page(paper: "a4"')).toBe(true);
    expect(TYP.match(/#set page\(/g)).toHaveLength(1);
  });

  it("writes a section as a heading and a point as a list item", () => {
    expect(TYP).toContain("== Experience");
    expect(TYP).toContain("- Mentored four engineers through their first on-call.");
  });

  // Two lines with a blank line between them are two paragraphs, so a run of
  // points separated that way is a list per point rather than one list.
  it("keeps a run of points together", () => {
    expect(TYP).toContain(
      "- Mentored four engineers through their first on-call.\n\n#text(size: 9.5pt)",
    );
    expect(TYP).not.toMatch(/^- .*\n\n- /m);
  });

  it("carries marks and links", () => {
    expect(TYP).toContain("#strong[measurable]");
    expect(TYP).toContain("#emph[large]");
    expect(TYP).toContain('#link("mailto:ada@example.org")');
  });

  // `//` opens a comment, which swallows the closing brackets after it and the
  // rest of the line with them.
  it("does not let an address comment out the line it is on", () => {
    expect(TYP).toContain('#link("https://github.com/acme/ingest")');
    expect(TYP).not.toMatch(/\[https:\/\//);
    expect(balanced(TYP)).toBe(true);
  });

  it("writes a run holding markup as a string rather than as markup", () => {
    const written = toTypst(onePoint("Cut cost by #1 metric: $2M *saved* [q3]"));

    expect(written).toContain('#text("Cut cost by #1 metric: $2M *saved* [q3]")');
    expect(balanced(written)).toBe(true);
  });

  it("escapes the two characters a string literal reads", () => {
    const written = toTypst(onePoint('Wrote a "parser" for C:\\logs # daily'));

    expect(written).toContain('#text("Wrote a \\"parser\\" for C:\\\\logs # daily")');
    expect(balanced(written)).toBe(true);
  });

  it("leaves a run with no markup in it alone", () => {
    expect(TYP).toContain("- Mentored four engineers through their first on-call.");
    expect(TYP).not.toContain('#text("Mentored four engineers');
  });

  it("gives an entry with no period no empty cell to sit beside", () => {
    expect(TYP).toContain("#strong[TypeScript]");
    expect(TYP).not.toContain("text(size: 9.5pt)[]");
  });
});
