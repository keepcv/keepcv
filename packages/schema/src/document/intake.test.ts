import { describe, expect, it } from "vitest";
import { CAREER_RECORD_KINDS, careerRecordInputSchema } from "../entities/career-record.js";
import { intakeRecordSchema, intakeSchema } from "./intake.js";

const BASE_ONLY = ["id", "sortKey", "organisationId", "summarySetId"];
const INTAKE_ONLY = ["organisationName", "summary", "points", "links", "tags"];

const keysOf = (
  union: typeof careerRecordInputSchema | typeof intakeRecordSchema,
  kind: string,
): string[] => {
  const option = union.options.find((each) => each.shape.kind.value === kind);
  if (option === undefined) throw new Error(`no ${kind} in the union`);
  return Object.keys(option.shape).sort();
};

const empty = {
  source: "json-resume",
  fidelity: "declared",
  identity: { fullName: null, headline: null, location: null, pronouns: null, summary: null },
  contactChannels: [],
  organisations: [],
  records: [],
  notes: [],
};

const record = {
  kind: "experience",
  title: "Analyst",
  subtitle: null,
  startedOn: "2019-03",
  endedOn: null,
  isCurrent: true,
  location: null,
  organisationName: "Analytical Engines",
  summary: null,
  points: [],
  links: [],
  tags: [],
  employmentType: "Full-time",
  mode: "remote",
};

describe("intakeRecordSchema", () => {
  // The one thing RECORD_EXTRAS exists to hold together. A kind whose extra
  // fields are declared at the `recordKind` call instead reaches the store and
  // is silently dropped by every reader.
  it.each(CAREER_RECORD_KINDS)("carries every field a stored %s has", (kind) => {
    const stored = keysOf(careerRecordInputSchema, kind).filter(
      (key) => !BASE_ONLY.includes(key) && key !== "customSectionId",
    );
    const arriving = keysOf(intakeRecordSchema, kind).filter(
      (key) => !INTAKE_ONLY.includes(key) && key !== "sectionHeading",
    );
    expect(arriving).toEqual(stored);
  });

  it("names the section a custom entry printed under, and never a section id", () => {
    const keys = keysOf(intakeRecordSchema, "custom_entry");
    expect(keys).toContain("sectionHeading");
    expect(keys).not.toContain("customSectionId");
  });

  // Nothing a reader produces may name a row, because a reader has never seen
  // the store it is headed for.
  it.each(CAREER_RECORD_KINDS)("carries no identity or ordering on a %s", (kind) => {
    expect(keysOf(intakeRecordSchema, kind)).not.toContain("id");
    expect(keysOf(intakeRecordSchema, kind)).not.toContain("sortKey");
    expect(keysOf(intakeRecordSchema, kind)).not.toContain("organisationId");
  });
});

describe("intakeSchema", () => {
  it("accepts a file that said almost nothing", () => {
    expect(intakeSchema.parse(empty).records).toEqual([]);
  });

  it("keeps the organisation as the name that was printed", () => {
    const parsed = intakeSchema.parse({ ...empty, records: [record] });
    expect(parsed.records[0]).toMatchObject({ organisationName: "Analytical Engines" });
  });

  it("refuses a source no reader in this build produces", () => {
    expect(intakeSchema.safeParse({ ...empty, source: "linkedin" }).success).toBe(false);
  });
});
