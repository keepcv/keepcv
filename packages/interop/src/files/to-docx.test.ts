import { FIXTURE_DOCUMENT } from "@keepcv/templates";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { docxLines } from "./docx.js";
import { toDocx } from "./to-docx.js";

const FILE = toDocx(FIXTURE_DOCUMENT);
const PARTS = unzipSync(FILE);
const part = (name: string): string => strFromU8(PARTS[name] ?? new Uint8Array());

const LINES = docxLines(FILE);
const said = (emphasis: string): string[] =>
  LINES.filter((line) => line.emphasis === emphasis).map((line) => line.text);

describe("writing a resume as a Word document", () => {
  it("holds the parts a reader opens it looking for", () => {
    expect(Object.keys(PARTS).toSorted()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "word/_rels/document.xml.rels",
      "word/document.xml",
      "word/numbering.xml",
      "word/styles.xml",
    ]);
  });

  // The file this writes is a file this reads, which is the only end-to-end
  // check there is on a format with no compiler to hand.
  it("reads back as the resume it was written from", () => {
    const printed = FIXTURE_DOCUMENT.sections.filter((section) => section.entries.length > 0);
    expect(said("heading")).toEqual(printed.map((section) => section.heading));

    const points = printed.flatMap((section) =>
      section.entries.flatMap((entry) => entry.points.map((point) => point.plainText)),
    );
    const listed = LINES.filter((line) => line.listed).map((line) => line.text);
    for (const point of points) expect(listed.some((text) => text.startsWith(point))).toBe(true);
  });

  // The period is a tab away from the title rather than a line below it, so a
  // reader pulling the text back out gets the two on one line.
  it("puts the name and every entry head where a reader finds them", () => {
    expect(said("strong")).toContain("Ada Lovelace");
    expect(said("strong")).toContain("Staff engineer - Ingest platform Apr 2023 - Present");
  });

  it("declares every relationship the body points at", () => {
    const rels = part("word/_rels/document.xml.rels");
    const used = [...part("word/document.xml").matchAll(/r:id="([^"]+)"/g)].map(
      (match) => match[1] ?? "",
    );

    expect(used.length).toBeGreaterThan(0);
    for (const id of new Set(used)) expect(rels).toContain(`Id="${id}"`);
    expect(rels).toContain('Target="mailto:ada@example.org"');
  });

  // One id for every address would point every link in the file at whichever
  // one was written first.
  it("gives each address its own relationship", () => {
    const rels = part("word/_rels/document.xml.rels");
    const targets = [...rels.matchAll(/Type="[^"]*hyperlink" Target="([^"]+)"/g)].map(
      (match) => match[1] ?? "",
    );
    const used = new Set(
      [...part("word/document.xml").matchAll(/r:id="([^"]+)"/g)].map((match) => match[1]),
    );

    expect(targets.length).toBeGreaterThan(1);
    expect(new Set(targets).size).toBe(targets.length);
    expect(used.size).toBe(targets.length);
  });

  it("carries bold and italic as marks rather than as characters", () => {
    const body = part("word/document.xml");
    expect(body).toContain("<w:b/>");
    expect(body).toContain("<w:i/>");
    expect(body).toContain('<w:t xml:space="preserve">measurable</w:t>');
  });

  // A `&` or a `<` in a name closes the tag it sits in and the part stops being
  // XML. The reader is forgiving enough to hand the text back anyway, so this
  // asserts the markup rather than the round trip.
  it("escapes a name that holds markup characters", () => {
    const risky = {
      ...FIXTURE_DOCUMENT,
      header: { ...FIXTURE_DOCUMENT.header, fullName: 'Ada & <b>Lovelace</b> "the" first' },
    };
    const body = strFromU8(unzipSync(toDocx(risky))["word/document.xml"] ?? new Uint8Array());

    expect(body).toContain("Ada &amp; &lt;b&gt;Lovelace&lt;/b&gt; &quot;the&quot; first");
    expect(body).not.toContain("<b>Lovelace</b>");
    expect(docxLines(toDocx(risky))[0]?.text).toBe('Ada & <b>Lovelace</b> "the" first');
  });

  // Two files built from one document have to be the same bytes, and a zip
  // stamps every entry with the time it was written unless it is told not to.
  // Asserted on the stamp rather than by writing twice: two writes a moment
  // apart share a DOS timestamp, which passes while the bytes are not fixed.
  it("stamps every entry with a fixed date", () => {
    expect(toDocx(FIXTURE_DOCUMENT)).toEqual(FILE);

    // The local file header's date field, two bytes at offset 12: 1980-01-01.
    for (const offset of [...FILE.keys()].filter(
      (index) =>
        FILE[index] === 0x50 &&
        FILE[index + 1] === 0x4b &&
        FILE[index + 2] === 0x03 &&
        FILE[index + 3] === 0x04,
    )) {
      expect([FILE[offset + 12], FILE[offset + 13]]).toEqual([0x21, 0x00]);
    }
  });
});
