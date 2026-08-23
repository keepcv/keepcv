import type { IntakeRecord } from "@keepcv/schema";
import { intakeSchema } from "@keepcv/schema";
import { FIXTURE_DOCUMENT } from "@keepcv/templates";
import { describe, expect, it } from "vitest";
import { fromJsonResume } from "./from-json-resume.js";
import type { JsonResume } from "./json-resume.js";
import { toJsonResume } from "./to-json-resume.js";

const read = (resume: JsonResume) => intakeSchema.parse(fromJsonResume(resume));

const of = (records: IntakeRecord[], kind: string) =>
  records.filter((record) => record.kind === kind);

describe("reading JSON Resume", () => {
  it("answers a valid intake for a file that is entirely empty", () => {
    const intake = read({});

    expect(intake.source).toBe("json-resume");
    expect(intake.records).toEqual([]);
    expect(intake.identity.fullName).toBeNull();
  });

  it("says the file named what it holds, because nothing here is guessed", () => {
    expect(read({}).fidelity).toBe("declared");
  });

  it("takes the person out of basics and the services out of profiles", () => {
    const intake = read({
      basics: {
        name: "Ada Lovelace",
        label: "Backend engineer",
        summary: "Ships measurable work.",
        email: "ada@example.org",
        phone: "+44 20 7946 0000",
        url: "https://ada.example",
        location: { city: "London", countryCode: "UK" },
        profiles: [
          { network: "GitHub", username: "ada", url: "https://github.com/ada" },
          { network: "Mastodon", url: "https://m.example/@ada" },
        ],
      },
    });

    expect(intake.identity).toEqual({
      fullName: "Ada Lovelace",
      headline: "Backend engineer",
      location: "London, UK",
      pronouns: null,
      summary: "Ships measurable work.",
    });
    expect(intake.contactChannels).toEqual([
      { kind: "email", label: null, value: "ada@example.org" },
      { kind: "phone", label: null, value: "+44 20 7946 0000" },
      { kind: "website", label: null, value: "https://ada.example" },
      { kind: "github", label: null, value: "ada" },
      { kind: "other", label: "Mastodon", value: "https://m.example/@ada" },
    ]);
  });

  it("collects one organisation from every list that named it", () => {
    const intake = read({
      work: [{ name: "Acme", position: "Staff engineer" }],
      volunteer: [{ organization: "Acme", position: "Mentor" }],
      education: [{ institution: "UCL", studyType: "BSc" }],
    });

    expect(intake.organisations.map((org) => org.name)).toEqual(["Acme", "UCL"]);
    expect(intake.organisations[0]).toMatchObject({ kind: "company" });
    expect(intake.organisations[1]).toMatchObject({ kind: "institution" });
  });

  it("keeps the work location, which only that list has a field for", () => {
    const [job] = of(
      read({ work: [{ position: "Staff engineer", location: "London" }] }).records,
      "experience",
    );

    expect(job).toMatchObject({ location: "London" });
  });

  // The format allows a month this store's CHECK constraint refuses, so a file
  // that is valid there still has to be reported rather than rejected whole.
  it("empties a date no calendar has and says which entry it was on", () => {
    const intake = read({ work: [{ position: "Analyst", startDate: "2019-19" }] });

    expect(intake.records[0]).toMatchObject({ startedOn: null });
    expect(intake.notes).toContain(
      '"2019-19" on Analyst is not a year, month or day, so that date is empty.',
    );
  });

  it("calls a job with no end date current, and an award never", () => {
    const intake = read({
      work: [{ position: "Analyst", startDate: "2019" }],
      awards: [{ title: "Turing Award", date: "2019" }],
    });

    expect(of(intake.records, "experience")[0]).toMatchObject({ isCurrent: true });
    expect(of(intake.records, "award")[0]).toMatchObject({ isCurrent: false, startedOn: "2019" });
  });

  // Rounding "Master" to the nearest of four would claim a level nobody wrote.
  it("sets a skill level it holds and reports one it does not", () => {
    const intake = read({
      skills: [
        { name: "Go", level: "Expert" },
        { name: "Rust", level: "Master" },
      ],
    });
    const skills = of(intake.records, "skill");

    expect(skills[0]).toMatchObject({ proficiency: "expert" });
    expect(skills[1]).toMatchObject({ proficiency: null });
    expect(intake.notes.some((note) => note.includes("Master"))).toBe(true);
  });

  it("files interests and references as custom entries rather than losing them", () => {
    const intake = read({
      interests: [{ name: "Cycling", keywords: ["road"] }],
      references: [{ name: "Grace Hopper", reference: "Worked with Ada for three years." }],
    });
    const custom = of(intake.records, "custom_entry");

    expect(custom).toHaveLength(2);
    expect(custom[0]).toMatchObject({
      sectionHeading: "Interests",
      title: "Cycling",
      tags: ["road"],
    });
    expect(custom[1]).toMatchObject({
      sectionHeading: "References",
      title: "Grace Hopper",
      summary: "Worked with Ada for three years.",
    });
  });

  it("names the course list it could not place instead of dropping it silently", () => {
    const intake = read({ education: [{ studyType: "BSc", courses: ["Algorithms"] }] });

    expect(intake.notes.some((note) => note.includes("course list"))).toBe(true);
  });

  it("carries no ordering, no ids and no section ids", () => {
    const intake = read({ work: [{ position: "Analyst" }] });
    const [record] = intake.records;

    expect(record).not.toHaveProperty("id");
    expect(record).not.toHaveProperty("sortKey");
    expect(record).not.toHaveProperty("organisationId");
  });
});

// The two adapters are each other's inverse over what the format can hold, so
// a field added to one and not the other shows up here as a dropped value.
describe("the round trip through JSON Resume", () => {
  const intake = read(toJsonResume(FIXTURE_DOCUMENT));

  it("brings the header back", () => {
    expect(intake.identity.fullName).toBe(FIXTURE_DOCUMENT.header.fullName);
    expect(intake.identity.headline).toBe(FIXTURE_DOCUMENT.header.headline);
    expect(intake.identity.location).toBe(FIXTURE_DOCUMENT.header.location);
  });

  it("brings back one record per entry the format has a list for", () => {
    const KEPT = new Set([
      "experience",
      "volunteering",
      "education",
      "award",
      "certification",
      "publication",
      "skill",
      "language",
      "project",
    ]);
    const sent = FIXTURE_DOCUMENT.sections
      .filter((section) => KEPT.has(section.kind))
      .flatMap((section) => section.entries);

    expect(intake.records).toHaveLength(sent.length);
  });

  it("brings every point back as a point", () => {
    const sent = FIXTURE_DOCUMENT.sections
      .flatMap((section) => section.entries)
      .filter((entry) => entry.kind === "experience" || entry.kind === "project")
      .flatMap((entry) => entry.points);

    expect(intake.records.flatMap((record) => record.points)).toHaveLength(sent.length);
  });

  it("brings every organisation back exactly once", () => {
    const named = new Set(
      FIXTURE_DOCUMENT.sections
        .flatMap((section) => section.entries)
        .map((entry) => entry.organisation?.name)
        .filter((name) => name !== undefined),
    );

    expect(intake.organisations.length).toBeLessThanOrEqual(named.size);
    for (const org of intake.organisations) expect(named).toContain(org.name);
  });

  it("keeps a period that was still going on still going on", () => {
    const current = intake.records.find((record) => record.title === "Staff engineer");

    expect(current).toMatchObject({ isCurrent: true, endedOn: null });
  });
});
