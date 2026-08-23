import { intakeSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { readDate, readPeriod } from "./dates.js";
import { fromLines } from "./from-lines.js";
import type { DocumentLine } from "./lines.js";

const line = (text: string, overrides: Partial<DocumentLine> = {}): DocumentLine => ({
  text,
  emphasis: "normal",
  listed: false,
  column: 0,
  page: 1,
  ...overrides,
});

const heading = (text: string) => line(text, { emphasis: "heading" });
const strong = (text: string) => line(text, { emphasis: "strong" });
const bullet = (text: string) => line(text, { listed: true });

const read = (lines: DocumentLine[]) => intakeSchema.parse(fromLines(lines, "pdf"));

describe("reading dates out of a resume", () => {
  it.each([
    ["2019", "2019"],
    ["2019-03", "2019-03"],
    ["2019/3", "2019-03"],
    ["March 2019", "2019-03"],
    ["Mar 2019", "2019-03"],
    ["Sept. 2019", "2019-09"],
    ["03/2019", "2019-03"],
  ])("reads %s", (text, expected) => {
    expect(readDate(text)).toBe(expected);
  });

  it.each(["Senior Engineer", "", "Acme Ltd", "2019-13", "Analyst 2019"])(
    "answers nothing for %s, which is not a date",
    (text) => {
      expect(readDate(text)).toBeNull();
    },
  );

  it("calls a period with no end still going on", () => {
    expect(readPeriod("Jan 2020 - Present")).toEqual({
      startedOn: "2020-01",
      endedOn: null,
      isCurrent: true,
    });
  });

  it("reads both ends of a closed period", () => {
    expect(readPeriod("2014 - 2017")).toEqual({
      startedOn: "2014",
      endedOn: "2017",
      isCurrent: false,
    });
  });

  // A hyphenated job title is not a period, and reading it as one empties the
  // title of every entry a template sets that way.
  it("answers nothing for a phrase that merely has a dash in it", () => {
    expect(readPeriod("Engineer - Platform")).toBeUndefined();
  });
});

describe("segmenting a resume into records", () => {
  const RESUME = [
    line("Ada Lovelace"),
    line("ada@example.org | +44 20 7946 0000 | github.com/ada"),
    heading("EXPERIENCE"),
    strong("Senior Engineer, Analytical Engines"),
    line("Jan 2020 - Present"),
    bullet("Cut batch runtime by 40%."),
    bullet("Led a team of four."),
    strong("Analyst, Globex"),
    line("2017 - 2019"),
    bullet("Built the first reporting pipeline."),
    heading("EDUCATION"),
    strong("BSc Mathematics, University of London"),
    line("2014 - 2017"),
    heading("SKILLS"),
    line("TypeScript, Postgres, Go"),
  ];

  const intake = read(RESUME);

  it("says the structure was worked out rather than declared", () => {
    expect(intake.fidelity).toBe("inferred");
  });

  it("takes the name and the contact details from above the first heading", () => {
    expect(intake.identity.fullName).toBe("Ada Lovelace");
    expect(intake.contactChannels).toEqual([
      { kind: "email", label: null, value: "ada@example.org" },
      { kind: "phone", label: null, value: "+44 20 7946 0000" },
      { kind: "github", label: null, value: "github.com/ada" },
    ]);
  });

  it("files each section under the kind its heading names", () => {
    const kinds = intake.records.map((record) => record.kind);
    expect(kinds).toContain("experience");
    expect(kinds).toContain("education");
    expect(kinds).toContain("skill");
  });

  it("puts the bullets under the entry above them", () => {
    const senior = intake.records.find((record) => record.title === "Senior Engineer");
    expect(senior?.points.map((point) => point.text)).toEqual([
      "Cut batch runtime by 40%.",
      "Led a team of four.",
    ]);
    expect(senior?.organisationName).toBe("Analytical Engines");
  });

  it("takes the period off the line under the entry head", () => {
    const senior = intake.records.find((record) => record.title === "Senior Engineer");
    expect(senior).toMatchObject({ startedOn: "2020-01", endedOn: null, isCurrent: true });

    const analyst = intake.records.find((record) => record.title === "Analyst");
    expect(analyst).toMatchObject({ startedOn: "2017", endedOn: "2019" });
  });

  it("collects the organisations the entries named", () => {
    expect(intake.organisations.map((org) => org.name).sort()).toEqual([
      "Analytical Engines",
      "Globex",
      "University of London",
    ]);
  });

  // A skills section is a list of names, not entries with bullets under them.
  it("makes one record per skill rather than one record holding all of them", () => {
    const skills = intake.records.filter((record) => record.kind === "skill");
    expect(skills.map((skill) => skill.title)).toEqual(["TypeScript", "Postgres", "Go"]);
  });

  it("carries no points on a skill", () => {
    for (const skill of intake.records.filter((record) => record.kind === "skill")) {
      expect(skill.points).toEqual([]);
    }
  });
});

describe("what the segmenter refuses to guess", () => {
  it("says so when the file had no headings at all", () => {
    const intake = read([line("Ada Lovelace"), line("Did some work somewhere.")]);

    expect(intake.records).toEqual([]);
    expect(intake.notes.some((note) => note.includes("No headings"))).toBe(true);
  });

  it("keeps a heading it does not file as a section of its own, and names it", () => {
    const intake = read([heading("LEADERSHIP"), strong("Captain, Rowing Club")]);

    expect(intake.records[0]).toMatchObject({
      kind: "custom_entry",
      sectionHeading: "LEADERSHIP",
      title: "Captain",
    });
    expect(intake.notes.some((note) => note.includes("LEADERSHIP"))).toBe(true);
  });

  it("leaves the headline and the location empty rather than picking a line", () => {
    const intake = read([
      line("Ada Lovelace"),
      line("Backend engineer, London"),
      heading("EXPERIENCE"),
      strong("Analyst, Acme"),
    ]);

    expect(intake.identity.headline).toBeNull();
    expect(intake.identity.location).toBeNull();
  });

  it("reads a bullet glyph as a bullet even when the file did not say so", () => {
    const intake = read([
      heading("EXPERIENCE"),
      strong("Analyst, Acme"),
      line(`\u2022 Shipped the thing.`),
    ]);

    expect(intake.records[0]?.points).toEqual([{ text: "Shipped the thing.", occurredOn: null }]);
  });
});
