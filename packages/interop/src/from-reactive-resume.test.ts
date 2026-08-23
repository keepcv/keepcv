import type { IntakeRecord } from "@keepcv/schema";
import { intakeSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { fromReactiveResume } from "./from-reactive-resume.js";
import type { ReactiveResume } from "./reactive-resume.js";

const read = (resume: ReactiveResume) => intakeSchema.parse(fromReactiveResume(resume));

const of = <K extends IntakeRecord["kind"]>(records: IntakeRecord[], kind: K) =>
  records.filter((record): record is Extract<IntakeRecord, { kind: K }> => record.kind === kind);

describe("reading Reactive Resume", () => {
  it("answers a valid intake for a file with nothing in it", () => {
    const intake = read({});

    expect(intake.source).toBe("reactive-resume");
    expect(intake.records).toEqual([]);
    expect(intake.organisations).toEqual([]);
  });

  it("says the file named what it holds, because nothing here is worked out", () => {
    expect(read({}).fidelity).toBe("declared");
  });

  it("takes the person out of basics and the summary out of its own section", () => {
    const intake = read({
      basics: {
        name: "Ada Lovelace",
        headline: "Backend engineer",
        location: "London, UK",
        email: "ada@example.org",
        phone: "+44 20 7946 0000",
        website: { url: "https://ada.example", label: "Site" },
      },
      summary: { content: "<p>Ships measurable work.</p>" },
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
      { kind: "website", label: "Site", value: "https://ada.example" },
    ]);
  });

  it("reads a profile as its own kind and an unlisted one as its network name", () => {
    const intake = read({
      sections: {
        profiles: {
          items: [
            { network: "GitHub", username: "ada" },
            { network: "Google Scholar", username: "ada-l" },
            { network: "Mastodon", username: "@ada@m.example" },
          ],
        },
      },
    });

    expect(intake.contactChannels).toEqual([
      { kind: "github", label: null, value: "ada" },
      { kind: "scholar", label: null, value: "ada-l" },
      { kind: "other", label: "Mastodon", value: "@ada@m.example" },
    ]);
  });

  it("keeps a header field the user added themselves, labelled by what it showed", () => {
    const intake = read({
      basics: { customFields: [{ text: "ada.dev", link: "https://ada.dev" }, { text: "she/her" }] },
    });

    expect(intake.contactChannels).toEqual([
      { kind: "other", label: "ada.dev", value: "https://ada.dev" },
      { kind: "other", label: null, value: "she/her" },
    ]);
  });

  it("splits a description into the summary and the points it listed", () => {
    const [job] = of(
      read({
        sections: {
          experience: {
            items: [
              {
                company: "Acme",
                position: "Staff engineer",
                period: "March 2021 - Present",
                description: "<p>Ran the platform team.</p><ul><li>Halved deploy time.</li></ul>",
              },
            ],
          },
        },
      }).records,
      "experience",
    );

    expect(job).toMatchObject({
      title: "Staff engineer",
      organisationName: "Acme",
      startedOn: "2021-03",
      isCurrent: true,
      summary: "Ran the platform team.",
      points: [{ text: "Halved deploy time.", occurredOn: null }],
    });
  });

  // A period is the line a template printed, so a file can hold one no reader
  // can turn into dates. Saying so beats emptying it quietly.
  it("names a period it could not read instead of dropping the dates", () => {
    const intake = read({
      sections: { experience: { items: [{ position: "Analyst", period: "about three years" }] } },
    });

    expect(intake.records[0]).toMatchObject({ startedOn: null, endedOn: null, isCurrent: false });
    expect(intake.notes).toContain(
      '"about three years" on Analyst is not a period this reads, so those dates are empty.',
    );
  });

  it("makes a record of every role held at one company, all under that company", () => {
    const intake = read({
      sections: {
        experience: {
          items: [
            {
              company: "Acme",
              position: "Staff engineer",
              period: "2019 - Present",
              roles: [
                { position: "Engineer", period: "2019 - 2021" },
                { position: "Senior engineer", period: "2021 - 2023" },
              ],
            },
          ],
        },
      },
    });

    expect(intake.records.map((record) => record.title)).toEqual([
      "Staff engineer",
      "Engineer",
      "Senior engineer",
    ]);
    expect(intake.organisations).toHaveLength(1);
    for (const record of intake.records) expect(record.organisationName).toBe("Acme");
  });

  // The store is what a resume is trimmed out of, so the thing that was trimmed
  // is exactly what an import must not skip.
  it("brings in an item the file was not printing", () => {
    const intake = read({
      sections: {
        experience: {
          hidden: true,
          items: [{ position: "Analyst", hidden: true, company: "Old" }],
        },
      },
    });

    expect(intake.records).toHaveLength(1);
    expect(intake.records[0]).toMatchObject({ title: "Analyst" });
  });

  // "Advanced" is a rung on the scale this editor offers, so translating it is
  // not the rounding the no-guessing rule forbids; "Master" is off both scales.
  it("translates the levels these tools name and reports one off the scale", () => {
    const intake = read({
      sections: {
        skills: {
          items: [
            { name: "Go", proficiency: "Expert", keywords: ["backend"] },
            { name: "Kubernetes", proficiency: "Advanced" },
            { name: "Elm", proficiency: "Beginner" },
            { name: "Rust", proficiency: "Master", level: 4 },
          ],
        },
      },
    });
    const skills = of(intake.records, "skill");

    expect(skills.map((skill) => skill.proficiency)).toEqual([
      "expert",
      "proficient",
      "familiar",
      null,
    ]);
    expect(skills[0]).toMatchObject({ tags: ["backend"] });
    expect(intake.notes.some((note) => note.includes("Master"))).toBe(true);
  });

  // One note however many skills carry a bar: which skill it was on tells the
  // reader nothing they can act on, and ten copies bury the notes that matter.
  it("reports the level bar once rather than once per skill", () => {
    const intake = read({
      sections: {
        skills: {
          items: [
            { name: "Go", level: 5 },
            { name: "Rust", level: 3 },
          ],
        },
      },
    });

    expect(intake.notes.filter((note) => note.includes("out of five"))).toHaveLength(1);
  });

  it("files a volunteering role under where it was done, which is all the format holds", () => {
    const [role] = of(
      read({
        sections: { volunteer: { items: [{ organization: "Code Club", period: "2020 - 2021" }] } },
      }).records,
      "volunteering",
    );

    expect(role).toMatchObject({ title: null, organisationName: "Code Club", endedOn: "2021" });
  });

  it("heads interests and references with what the file called those sections", () => {
    const intake = read({
      sections: {
        interests: { title: "Outside work", items: [{ name: "Cycling", keywords: ["road"] }] },
        references: {
          title: "Who to ask",
          items: [
            { name: "Grace Hopper", position: "CTO", phone: "555", description: "<p>Yes.</p>" },
          ],
        },
      },
    });
    const custom = of(intake.records, "custom_entry");

    expect(custom[0]).toMatchObject({ sectionHeading: "Outside work", title: "Cycling" });
    expect(custom[1]).toMatchObject({
      sectionHeading: "Who to ask",
      title: "Grace Hopper",
      subtitle: "CTO",
      summary: "Yes.",
    });
    expect(intake.notes.some((note) => note.includes("phone number"))).toBe(true);
  });

  // A job the user filed under a heading of their own is still a job, and
  // flattening it would take it out of the list every other job is in.
  it("files a custom section's entries as what they are and names the lost heading", () => {
    const intake = read({
      customSections: [
        {
          title: "Consulting",
          type: "experience",
          items: [{ company: "Beta", position: "Advisor" }],
        },
      ],
    });

    expect(intake.records[0]).toMatchObject({ kind: "experience", title: "Advisor" });
    expect(intake.notes.some((note) => note.includes("Consulting"))).toBe(true);
  });

  it("keeps prose under its own heading, which is the one thing with no kind", () => {
    const intake = read({
      customSections: [
        { title: "Statement", type: "summary", items: [{ content: "<p>Why I do this.</p>" }] },
      ],
    });

    expect(intake.records[0]).toMatchObject({
      kind: "custom_entry",
      sectionHeading: "Statement",
      summary: "Why I do this.",
    });
    expect(intake.notes).toEqual([]);
  });

  it("says a custom section it cannot read was not read, rather than passing over it", () => {
    const intake = read({
      customSections: [{ title: "Patents", type: "patents", items: [{ name: "A thing" }] }],
    });

    expect(intake.records).toEqual([]);
    expect(intake.notes.some((note) => note.includes("Patents"))).toBe(true);
  });

  it("carries no ids, no ordering and no section ids", () => {
    const intake = read({
      sections: { experience: { items: [{ id: "abc", position: "Analyst" }] } },
    });
    const [record] = intake.records;

    expect(record).not.toHaveProperty("id");
    expect(record).not.toHaveProperty("sortKey");
    expect(record).not.toHaveProperty("organisationId");
  });
});
