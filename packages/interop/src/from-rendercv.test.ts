import type { IntakeRecord } from "@keepcv/schema";
import { intakeSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { fromRenderCv } from "./from-rendercv.js";
import type { RenderCvFile } from "./rendercv.js";

const read = (file: RenderCvFile) => intakeSchema.parse(fromRenderCv(file));

const only = (records: IntakeRecord[]) => records[0];

describe("reading RenderCV", () => {
  it("answers a valid intake for a file with an empty cv", () => {
    const intake = read({ cv: {} });

    expect(intake.source).toBe("rendercv");
    expect(intake.records).toEqual([]);
  });

  it("takes every value out of a header field that holds a list of them", () => {
    const intake = read({
      cv: {
        name: "Ada Lovelace",
        headline: "Backend engineer",
        location: "London",
        email: ["ada@example.org", "ada@work.example"],
        phone: "+44 20 7946 0000",
        website: "https://ada.example",
      },
    });

    expect(intake.identity).toMatchObject({ fullName: "Ada Lovelace", location: "London" });
    expect(intake.contactChannels).toEqual([
      { kind: "email", label: null, value: "ada@example.org" },
      { kind: "email", label: null, value: "ada@work.example" },
      { kind: "phone", label: null, value: "+44 20 7946 0000" },
      { kind: "website", label: null, value: "https://ada.example" },
    ]);
  });

  // The file writes the network as two words and this store keeps it as one.
  it("reads a social network as its own kind and an unlisted one by name", () => {
    const intake = read({
      cv: {
        social_networks: [
          { network: "GitHub", username: "ada" },
          { network: "Google Scholar", username: "ada-l" },
          { network: "Mastodon", username: "@ada@m.example" },
        ],
        custom_connections: [{ placeholder: "Blog", url: "https://ada.example/blog" }],
      },
    });

    expect(intake.contactChannels).toEqual([
      { kind: "github", label: null, value: "ada" },
      { kind: "scholar", label: null, value: "ada-l" },
      { kind: "other", label: "Mastodon", value: "@ada@m.example" },
      { kind: "other", label: "Blog", value: "https://ada.example/blog" },
    ]);
  });

  // The heading is the only name a section has, and an entry that already says
  // it is a job must not be refiled by the word above it. "Projects" maps to a
  // kind of its own, so this fails the moment the heading is consulted first.
  it("lets the entry decide the kind even under a heading that means another", () => {
    const intake = read({
      cv: {
        sections: {
          Projects: [{ company: "Acme", position: "Staff engineer", start_date: "2021-03" }],
        },
      },
    });

    expect(only(intake.records)).toMatchObject({
      kind: "experience",
      title: "Staff engineer",
      organisationName: "Acme",
      startedOn: "2021-03",
      isCurrent: true,
    });
  });

  it("reads a degree, its subject and where it was taken", () => {
    const intake = read({
      cv: {
        sections: {
          Education: [
            {
              institution: "UCL",
              area: "Computer Science",
              degree: "BSc",
              start_date: 2015,
              end_date: 2018,
            },
          ],
        },
      },
    });

    expect(only(intake.records)).toMatchObject({
      kind: "education",
      title: "BSc",
      subtitle: "Computer Science",
      organisationName: "UCL",
      startedOn: "2015",
      endedOn: "2018",
      isCurrent: false,
    });
  });

  it("keeps a publication's doi, its authors and the journal that ran it", () => {
    const intake = read({
      cv: {
        sections: {
          Publications: [
            {
              title: "On computable numbers",
              authors: ["**Ada Lovelace**", "Alan Turing"],
              journal: "Proc. LMS",
              doi: "10.1112/plms/s2-42.1.230",
              date: 1936,
              url: "https://example.org/paper",
            },
          ],
        },
      },
    });

    expect(only(intake.records)).toMatchObject({
      kind: "publication",
      title: "On computable numbers",
      subtitle: "Ada Lovelace, Alan Turing",
      organisationName: "Proc. LMS",
      doi: "10.1112/plms/s2-42.1.230",
      startedOn: "1936",
      links: [{ kind: "other", label: null, url: "https://example.org/paper" }],
    });
  });

  it("says a period ending in present is still going on, and one with no start is not", () => {
    const going = read({
      cv: {
        sections: {
          Work: [{ company: "Acme", position: "Lead", start_date: "2021-03", end_date: "present" }],
        },
      },
    });
    const nowhere = read({
      cv: { sections: { Work: [{ company: "Acme", position: "Lead", end_date: "present" }] } },
    });

    expect(only(going.records)).toMatchObject({ startedOn: "2021-03", isCurrent: true });
    expect(only(nowhere.records)).toMatchObject({ startedOn: null, isCurrent: false });
  });

  it("works the kind out from the heading for the entries that do not say", () => {
    const intake = read({
      cv: {
        sections: {
          Projects: [{ name: "Difference engine", summary: "A machine.", date: "2020" }],
          "Awards and Honours": [{ name: "Turing Award", date: "2019" }],
          "Talks and Presentations": [{ name: "On engines", location: "Berlin" }],
        },
      },
    });

    expect(intake.records.map((record) => record.kind)).toEqual(["project", "award", "speaking"]);
    expect(intake.records[0]).toMatchObject({ title: "Difference engine", summary: "A machine." });
  });

  // Both headings hold the word, and only one of them is about a language.
  it("tells programming languages from languages", () => {
    const intake = read({
      cv: {
        sections: {
          Languages: [{ label: "English", details: "Native" }],
          "Programming Languages": [{ label: "Backend", details: "Go, Rust" }],
        },
      },
    });

    expect(intake.records[0]).toMatchObject({
      kind: "language",
      title: "English",
      subtitle: null,
      proficiency: "Native",
    });
    expect(intake.records[1]).toMatchObject({
      kind: "skill",
      title: "Backend",
      subtitle: "Go, Rust",
    });
  });

  it("reads Research Experience as experience rather than as publications", () => {
    const intake = read({
      cv: { sections: { "Research Experience": [{ name: "Worked on engines" }] } },
    });

    expect(only(intake.records)).toMatchObject({ kind: "experience" });
  });

  // "Frameworks" holds the word "work" and is a list of tools, not of jobs.
  it("does not read a heading as work because a longer word contains it", () => {
    const intake = read({ cv: { sections: { Frameworks: [{ bullet: "React, Hono" }] } } });

    expect(only(intake.records)).toMatchObject({
      kind: "custom_entry",
      sectionHeading: "Frameworks",
    });
  });

  // A heading nothing matches keeps the word the user chose, which is what a
  // custom section is for; filing it under a near miss would lose it.
  it("makes a section of its own out of a heading nothing matches", () => {
    const intake = read({
      cv: {
        sections: {
          "Security Clearance": [{ label: "Level", details: "Top Secret" }],
          Miscellany: ["A bare line", { bullet: "Another line" }],
        },
      },
    });

    expect(intake.records[0]).toMatchObject({
      kind: "custom_entry",
      sectionHeading: "Security Clearance",
      title: "Level",
      subtitle: "Top Secret",
    });
    expect(intake.records.slice(1)).toMatchObject([
      { kind: "custom_entry", sectionHeading: "Miscellany", title: "A bare line" },
      { kind: "custom_entry", sectionHeading: "Miscellany", title: "Another line" },
    ]);
  });

  it("takes the marks out of the text and says a link inside a sentence went", () => {
    const intake = read({
      cv: {
        sections: {
          Work: [
            {
              company: "Acme",
              position: "**Staff** engineer",
              highlights: ["Shipped [the thing](https://x.example) on time."],
            },
          ],
        },
      },
    });

    expect(only(intake.records)).toMatchObject({
      title: "Staff engineer",
      points: [{ text: "Shipped the thing on time.", occurredOn: null }],
    });
    expect(intake.notes.some((note) => note.includes("inside a sentence"))).toBe(true);
  });

  // The tool's own example puts a repository link in the date slot, and reading
  // it as a date loses the link and reports a date nobody wrote.
  it("takes a link out of the date slot as a link", () => {
    const intake = read({
      cv: {
        sections: {
          Projects: [
            { name: "A tool", date: "[github.com/ada/tool](https://github.com/ada/tool)" },
          ],
        },
      },
    });

    expect(only(intake.records)).toMatchObject({
      startedOn: null,
      links: [{ kind: "other", label: "github.com/ada/tool", url: "https://github.com/ada/tool" }],
    });
    expect(intake.notes).toEqual([]);
  });

  // The tool's own example heads a list of one-line entries "additional
  // experience and awards", and filing those as jobs puts a teaching note in
  // the work history next to two real employers.
  it("keeps a labelled fact out of the work history whatever the heading says", () => {
    const intake = read({
      cv: {
        sections: {
          "Additional Experience and Awards": [
            { label: "Instructor (2003 - 2005)", details: "Taught 3 undergraduate courses." },
          ],
        },
      },
    });

    expect(only(intake.records)).toMatchObject({
      kind: "custom_entry",
      sectionHeading: "Additional Experience and Awards",
      title: "Instructor (2003 - 2005)",
    });
  });

  it("names a date it could not read rather than emptying it quietly", () => {
    const intake = read({
      cv: { sections: { Awards: [{ name: "A prize", date: "sometime in spring" }] } },
    });

    expect(only(intake.records)).toMatchObject({ startedOn: null });
    expect(intake.notes).toContain(
      '"sometime in spring" on A prize is not a date this reads, so it is empty.',
    );
  });

  it("says the photo has nowhere to go", () => {
    expect(read({ cv: { photo: "me.jpg" } }).notes.some((note) => note.includes("photo"))).toBe(
      true,
    );
  });

  it("carries no ids, no ordering and no section ids", () => {
    const intake = read({ cv: { sections: { Work: [{ position: "Analyst" }] } } });
    const [record] = intake.records;

    expect(record).not.toHaveProperty("id");
    expect(record).not.toHaveProperty("sortKey");
    expect(record).not.toHaveProperty("organisationId");
  });
});
