import { strToU8, zipSync, zlibSync } from "fflate";
import { describe, expect, it } from "vitest";
import { fromLines } from "../from-lines.js";
import { docxLines, NotADocxError } from "./docx.js";
import { NotAPdfError, pdfLines } from "./pdf.js";
import { NotARenderCvError, parseRenderCv } from "./yaml.js";

interface Drawn {
  text: string;
  size: number;
  font: "F1" | "F2";
  x: number;
  y: number;
}

// Latin-1, which is how a PDF writes a string outside a compressed stream.
const bytes = (text: string): Uint8Array =>
  Uint8Array.from(text, (character) => character.charCodeAt(0) & 0xff);

const joined = (parts: readonly Uint8Array[]): Uint8Array => {
  const all = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    all.set(part, at);
    at += part.length;
  }
  return all;
};

// A real PDF, built here rather than committed: a fixture whose bytes nobody
// can read is a fixture nobody can change.
function aPdf(lines: readonly Drawn[], compress = false): Uint8Array {
  const stream = lines
    .map(
      (line) =>
        `BT /${line.font} ${String(line.size)} Tf ${String(line.x)} ${String(line.y)} Td (${line.text}) Tj ET`,
    )
    .join("\n");

  const content = compress ? zlibSync(bytes(stream)) : bytes(stream);
  const objects: (string | { dict: string; raw: Uint8Array })[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    {
      dict: `<< /Length ${String(content.length)}${compress ? " /Filter /FlateDecode" : ""} >>`,
      raw: content,
    },
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];

  const chunks: Uint8Array[] = [];
  let length = 0;
  const offsets: number[] = [];
  const push = (text: string) => {
    const part = bytes(text);
    chunks.push(part);
    length += part.length;
  };

  push("%PDF-1.4\n");
  objects.forEach((object, index) => {
    offsets.push(length);
    if (typeof object === "string") {
      push(`${String(index + 1)} 0 obj\n${object}\nendobj\n`);
      return;
    }
    push(`${String(index + 1)} 0 obj\n${object.dict}\nstream\n`);
    chunks.push(object.raw);
    length += object.raw.length;
    push("\nendstream\nendobj\n");
  });

  const startxref = length;
  push(`xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`);
  for (const offset of offsets) push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  push(
    `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(startxref)}\n%%EOF\n`,
  );

  return joined(chunks);
}

const A_RESUME: Drawn[] = [
  { text: "Ada Lovelace", size: 20, font: "F2", x: 72, y: 740 },
  { text: "ada@example.org | +44 20 7946 0000", size: 9, font: "F1", x: 72, y: 722 },
  { text: "EXPERIENCE", size: 13, font: "F2", x: 72, y: 690 },
  { text: "Senior Engineer, Analytical Engines", size: 10, font: "F2", x: 72, y: 672 },
  { text: "Jan 2020 - Present", size: 10, font: "F1", x: 72, y: 660 },
  { text: "- Cut batch runtime by 40%.", size: 10, font: "F1", x: 80, y: 646 },
  {
    text: "- Led a team of four through the migration off punch cards.",
    size: 10,
    font: "F1",
    x: 80,
    y: 632,
  },
  {
    text: "- Wrote the scheduler the reporting pipeline still runs on.",
    size: 10,
    font: "F1",
    x: 80,
    y: 618,
  },
  { text: "EDUCATION", size: 13, font: "F2", x: 72, y: 580 },
  { text: "BSc Mathematics, University of London", size: 10, font: "F2", x: 72, y: 562 },
  { text: "2014 - 2017", size: 10, font: "F1", x: 72, y: 550 },
];

describe("pulling lines out of a PDF", () => {
  it("reads one line per printed line, in the order they were set", async () => {
    const lines = await pdfLines(aPdf(A_RESUME));

    expect(lines.map((line) => line.text)).toEqual([
      "Ada Lovelace",
      "ada@example.org | +44 20 7946 0000",
      "EXPERIENCE",
      "Senior Engineer, Analytical Engines",
      "Jan 2020 - Present",
      "- Cut batch runtime by 40%.",
      "- Led a team of four through the migration off punch cards.",
      "- Wrote the scheduler the reporting pipeline still runs on.",
      "EDUCATION",
      "BSc Mathematics, University of London",
      "2014 - 2017",
    ]);
  });

  it("reads a compressed content stream, which is what a real template writes", async () => {
    const lines = await pdfLines(aPdf(A_RESUME, true));

    expect(lines.map((line) => line.text)).toContain("EXPERIENCE");
  });

  it("calls the biggest text a heading and the body text normal", async () => {
    const lines = await pdfLines(aPdf(A_RESUME));
    const of = (text: string) => lines.find((line) => line.text === text);

    expect(of("EXPERIENCE")?.emphasis).toBe("heading");
    expect(of("Jan 2020 - Present")?.emphasis).toBe("normal");
  });

  // The size rule alone reads the name as a heading, and then every section of
  // the resume is filed under the person's own name.
  it("does not call the name at the top a section heading", async () => {
    const lines = await pdfLines(aPdf(A_RESUME));

    expect(lines.find((line) => line.text === "Ada Lovelace")?.emphasis).not.toBe("heading");
  });

  // A PDF says nothing about lists, so the glyph in front is the only signal.
  it("marks a line that starts with a bullet glyph", async () => {
    const lines = await pdfLines(aPdf(A_RESUME));

    expect(lines.find((line) => line.text.includes("Cut batch"))?.listed).toBe(true);
  });

  // Read top-to-bottom a two-column resume interleaves two unrelated sections,
  // which is the failure that makes every entry in both of them wrong. The
  // columns are staggered because two independent columns do not share
  // baselines; something that does share one is a right-aligned date.
  it("reads a two-column layout one column at a time", async () => {
    const lines = await pdfLines(
      aPdf([
        { text: "EXPERIENCE", size: 13, font: "F2", x: 60, y: 700 },
        { text: "SKILLS", size: 13, font: "F2", x: 340, y: 694 },
        { text: "Staff Engineer", size: 10, font: "F1", x: 60, y: 684 },
        { text: "TypeScript", size: 10, font: "F1", x: 340, y: 678 },
        { text: "Shipped the thing.", size: 10, font: "F1", x: 60, y: 670 },
        { text: "Postgres", size: 10, font: "F1", x: 340, y: 662 },
        { text: "Ran the other thing.", size: 10, font: "F1", x: 60, y: 656 },
        { text: "Kubernetes", size: 10, font: "F1", x: 340, y: 646 },
      ]),
    );

    expect(lines.map((line) => line.text)).toEqual([
      "EXPERIENCE",
      "Staff Engineer",
      "Shipped the thing.",
      "Ran the other thing.",
      "SKILLS",
      "TypeScript",
      "Postgres",
      "Kubernetes",
    ]);
  });

  it("refuses bytes that are not a PDF", async () => {
    await expect(pdfLines(bytes("hello"))).rejects.toBeInstanceOf(NotAPdfError);
  });

  it("segments into records the same way any other line source does", async () => {
    const intake = fromLines(await pdfLines(aPdf(A_RESUME)), "pdf");

    expect(intake.identity.fullName).toBe("Ada Lovelace");
    const senior = intake.records.find((record) => record.title === "Senior Engineer");
    expect(senior).toMatchObject({
      kind: "experience",
      organisationName: "Analytical Engines",
      startedOn: "2020-01",
      isCurrent: true,
    });
    expect(senior?.points.map((point) => point.text)).toEqual([
      "Cut batch runtime by 40%.",
      "Led a team of four through the migration off punch cards.",
      "Wrote the scheduler the reporting pipeline still runs on.",
    ]);
  });
});

const paragraph = (
  text: string,
  options: { style?: string; listed?: boolean; bold?: boolean } = {},
) => {
  const style = options.style === undefined ? "" : `<w:pStyle w:val="${options.style}"/>`;
  const listed = options.listed === true ? '<w:numPr><w:ilvl w:val="0"/></w:numPr>' : "";
  const properties = style === "" && listed === "" ? "" : `<w:pPr>${style}${listed}</w:pPr>`;
  const bold = options.bold === true ? "<w:rPr><w:b/></w:rPr>" : "";
  return `<w:p>${properties}<w:r>${bold}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
};

function aDocx(body: string): Uint8Array {
  return zipSync({
    "[Content_Types].xml": strToU8("<?xml version='1.0'?><Types/>"),
    "word/document.xml": strToU8(
      `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
    ),
  });
}

describe("pulling lines out of a DOCX", () => {
  const BODY = [
    paragraph("Ada Lovelace", { style: "Title" }),
    paragraph("ada@example.org"),
    paragraph("Experience", { style: "Heading1" }),
    paragraph("Senior Engineer, Analytical Engines", { bold: true }),
    paragraph("Cut batch runtime by 40%.", { listed: true }),
  ].join("");

  it("takes the heading, the list and the bold from what the file declared", () => {
    const lines = docxLines(aDocx(BODY));

    expect(lines.map((line) => [line.text, line.emphasis, line.listed])).toEqual([
      ["Ada Lovelace", "strong", false],
      ["ada@example.org", "normal", false],
      ["Experience", "heading", false],
      ["Senior Engineer, Analytical Engines", "strong", false],
      ["Cut batch runtime by 40%.", "normal", true],
    ]);
  });

  it("decodes the entities Word writes rather than printing them", () => {
    const lines = docxLines(aDocx(paragraph("Research &amp; Development &#8212; 2019")));

    expect(lines[0]?.text).toBe(`Research & Development ${String.fromCodePoint(0x2014)} 2019`);
  });

  // Two runs either side of a break become one joined word without this, and
  // the joined word is what a reviewer then has to spot and fix by hand.
  it("keeps a break between the runs on each side of it", () => {
    const body =
      "<w:p><w:r><w:t>Line one</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>line two</w:t></w:r></w:p>";

    expect(docxLines(aDocx(body))[0]?.text).toBe("Line one line two");
  });

  it("refuses bytes that are not a Word document", () => {
    expect(() => docxLines(bytes("hello"))).toThrow(NotADocxError);
  });

  it("segments into records the same way any other line source does", () => {
    const intake = fromLines(docxLines(aDocx(BODY)), "docx");

    expect(intake.records[0]).toMatchObject({
      kind: "experience",
      title: "Senior Engineer",
      organisationName: "Analytical Engines",
    });
    expect(intake.records[0]?.points).toEqual([
      { text: "Cut batch runtime by 40%.", occurredOn: null },
    ]);
  });
});

// A resume that uses Heading1 for its sections and Heading2 for job titles is
// common, and reading both as sections files every job under itself.
describe("which heading level a DOCX means as a section", () => {
  const of = (body: string) => docxLines(aDocx(body)).map((line) => line.emphasis);

  it("takes the shallowest level present as the section level", () => {
    const body = [
      paragraph("Experience", { style: "Heading1" }),
      paragraph("Senior Engineer", { style: "Heading2" }),
    ].join("");

    expect(of(body)).toEqual(["heading", "strong"]);
  });

  it("takes Heading2 as the section when nothing is a Heading1", () => {
    const body = [
      paragraph("Experience", { style: "Heading2" }),
      paragraph("Senior Engineer"),
    ].join("");

    expect(of(body)).toEqual(["heading", "normal"]);
  });
});

const yaml = (...lines: string[]) => lines.join("\n");

describe("reading a RenderCV file", () => {
  it("answers the object under `cv`, which is all this format keeps content in", () => {
    const file = parseRenderCv(
      yaml("cv:", "  name: Ada Lovelace", "  sections:", "    Work:", "      - company: Acme"),
    );

    expect(file.cv?.name).toBe("Ada Lovelace");
    expect(file.cv?.sections?.["Work"]).toEqual([{ company: "Acme" }]);
  });

  // A year is unquoted in every example the tool ships, so it arrives as a
  // number and a reader that only accepts strings loses every date.
  it("reads an unquoted year as the number YAML says it is", () => {
    const file = parseRenderCv(
      yaml("cv:", "  sections:", "    Education:", "      - start_date: 2015"),
    );

    expect(file.cv?.sections?.["Education"]).toEqual([{ start_date: 2015 }]);
  });

  it("refuses YAML that is not this format rather than answering an empty cv", () => {
    expect(() => parseRenderCv(yaml("basics:", "  name: Ada"))).toThrow(NotARenderCvError);
    expect(() => parseRenderCv("cv: [unclosed")).toThrow(NotARenderCvError);
  });
});
