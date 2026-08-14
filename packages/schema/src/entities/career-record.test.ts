import { describe, expect, it } from "vitest";
import {
  CAREER_RECORD_KINDS,
  type CareerRecordKind,
  careerRecordInputSchema,
  careerRecordPatchSchema,
  careerRecordSchema,
} from "./career-record.js";

const shared = {
  id: "019891a4-6ac5-7000-8000-000000000003",
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
  archivedAt: null,
  title: "Analyst",
  subtitle: null,
  organisationId: null,
  startedOn: "2019-03",
  endedOn: null,
  isCurrent: true,
  location: null,
  sortKey: "a0",
  summarySetId: null,
};

const extrasByKind: Record<CareerRecordKind, Record<string, unknown>> = {
  experience: { employmentType: "Full-time", mode: "remote" },
  education: { grade: "First", gradeScale: "UK", thesisTitle: null, honours: null },
  project: {},
  skill: { category: "Languages", proficiency: "expert" },
  certification: { credentialId: "AWS-1234", expiresOn: "2027-03" },
  publication: { doi: "10.1000/182" },
  award: {},
  language: { proficiency: "C1" },
  volunteering: {},
  speaking: {},
};

describe("careerRecordSchema", () => {
  it.each(CAREER_RECORD_KINDS)("accepts a %s and keeps its own fields", (kind) => {
    const parsed = careerRecordSchema.parse({ ...shared, kind, ...extrasByKind[kind] });
    expect(parsed).toEqual({ ...shared, kind, ...extrasByKind[kind] });
  });

  it("rejects an undeclared kind", () => {
    expect(careerRecordSchema.safeParse({ ...shared, kind: "patent" }).success).toBe(false);
  });

  // Reading relies on this: the repository hands every column of the one `record`
  // table to the union and lets the kind decide which of them survive.
  it("drops fields belonging to another kind", () => {
    const parsed = careerRecordSchema.parse({
      ...shared,
      kind: "education",
      ...extrasByKind.education,
      mode: "remote",
    });
    expect(parsed).not.toHaveProperty("mode");
  });

  it("rejects a date at a precision no calendar has", () => {
    expect(
      careerRecordSchema.safeParse({ ...shared, kind: "award", startedOn: "2019-13" }).success,
    ).toBe(false);
  });

  // P-A: contradictory is still saveable. "Still there" alongside a filled-in end
  // date is something the UI nudges about, never something storage refuses.
  it("accepts an ongoing period that also has an end date", () => {
    const parsed = careerRecordSchema.parse({
      ...shared,
      kind: "experience",
      ...extrasByKind.experience,
      endedOn: "2024",
    });
    expect(parsed.isCurrent).toBe(true);
    expect(parsed.endedOn).toBe("2024");
  });
});

describe("careerRecordInputSchema", () => {
  it("takes the id from the caller and nothing the store owns", () => {
    const input = careerRecordInputSchema.parse({ ...shared, kind: "project" });
    expect(input).toHaveProperty("id");
    expect(input).not.toHaveProperty("createdAt");
    expect(input).not.toHaveProperty("updatedAt");
    expect(input).not.toHaveProperty("archivedAt");
  });
});

describe("careerRecordPatchSchema", () => {
  it("needs only the kind, so a patch of one field is a valid patch", () => {
    expect(careerRecordPatchSchema.parse({ kind: "skill", category: "Databases" })).toEqual({
      kind: "skill",
      category: "Databases",
    });
  });

  it("refuses a patch with no kind, because it could not be checked against one", () => {
    expect(careerRecordPatchSchema.safeParse({ title: "Turing Award" }).success).toBe(false);
  });

  it("carries no id, so a patch cannot re-target itself", () => {
    expect(careerRecordPatchSchema.parse({ kind: "award", id: shared.id })).toEqual({
      kind: "award",
    });
  });
});
