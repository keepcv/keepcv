import type { ResumeDocument } from "@keepcv/schema";
import { FIXTURE_DOCUMENT } from "@keepcv/templates";
import { describe, expect, it } from "vitest";
import { JSON_RESUME_SCHEMA } from "./json-resume.js";
import { lossOf } from "./loss.js";
import { toJsonResume } from "./to-json-resume.js";

const RESUME = toJsonResume(FIXTURE_DOCUMENT);

const kinds = (document: ResumeDocument) => document.sections.map((section) => section.kind);

describe("writing a resume as JSON Resume", () => {
  it("names the schema it claims to be", () => {
    expect(RESUME.$schema).toBe(JSON_RESUME_SCHEMA);
    expect(RESUME.meta).toEqual({
      version: "v1.0.0",
      lastModified: FIXTURE_DOCUMENT.meta.generatedAt,
    });
  });

  it("puts the person in basics, with the services as profiles", () => {
    expect(RESUME.basics).toMatchObject({
      name: "Ada Lovelace",
      label: "Backend engineer, distributed systems",
      email: "ada@example.org",
      phone: "+44 20 7946 0000",
      location: { address: "London, UK" },
    });
    // Plain text: the summary is bold and italic in the store.
    expect(RESUME.basics?.summary).toBe("Ships measurable work on large ingest systems.");
    expect(RESUME.basics?.profiles).toEqual([
      { network: "GitHub", username: "github.com/ada", url: "https://github.com/ada" },
    ]);
  });

  // Location is a contact channel and an address is not a profile; both used to
  // be plausible readings of "everything with a value goes in profiles".
  it("keeps location, email and phone out of profiles", () => {
    const networks = (RESUME.basics?.profiles ?? []).map((profile) => profile.network);

    expect(networks).not.toContain("location");
    expect(networks).not.toContain("email");
  });

  it("puts experience under work, with the points as highlights", () => {
    const [first] = RESUME.work ?? [];

    expect(first).toMatchObject({ name: "Acme", position: "Staff engineer", startDate: "2023-04" });
    expect(first?.highlights?.length).toBeGreaterThan(0);
  });

  // `display` is ours - "Feb 2021 - Present" is not a date anything can parse.
  it("sends the dates the record holds, not the ones the resume printed", () => {
    for (const job of RESUME.work ?? []) {
      if (job.startDate !== undefined) expect(job.startDate).toMatch(/^\d{4}(-\d{2}){0,2}$/);
      if (job.endDate !== undefined) expect(job.endDate).toMatch(/^\d{4}(-\d{2}){0,2}$/);
    }
  });

  it("has no endDate on something still going on", () => {
    const current = (RESUME.work ?? []).find((job) => job.position === "Staff engineer");

    expect(current?.endDate).toBeUndefined();
  });

  it("files each kind under the list the format has for it", () => {
    const of = (kind: string) =>
      FIXTURE_DOCUMENT.sections.filter((row) => row.kind === kind).flatMap((row) => row.entries);

    expect(RESUME.skills).toHaveLength(of("skill").length);
    expect(RESUME.skills?.[0]?.name).toBe(of("skill")[0]?.title);
    expect(RESUME.certificates).toHaveLength(of("certification").length);
    expect(RESUME.certificates?.[0]?.name).toBe(of("certification")[0]?.title);
  });

  it("leaves out a list this resume has nothing for", () => {
    expect(kinds(FIXTURE_DOCUMENT)).not.toContain("language");
    expect(RESUME).not.toHaveProperty("languages");
    expect(RESUME).not.toHaveProperty("volunteer");
  });

  it("is JSON that survives a round trip through a file", () => {
    expect(JSON.parse(JSON.stringify(RESUME))).toEqual(RESUME);
  });
});

describe("what does not survive the trip", () => {
  const losses = lossOf(FIXTURE_DOCUMENT, "jsonresume");
  const named = (what: string) => losses.find((loss) => loss.what === what);

  // The fixture's custom section is exactly the case the format cannot hold.
  it("names the section that has nowhere to go, and how much is in it", () => {
    const loss = named("Sections with nowhere to go");

    expect(loss?.count).toBeGreaterThan(0);
    expect(loss?.detail).toContain("Selected writing");
  });

  it("counts the metrics a highlight cannot carry", () => {
    expect(named("Metrics")?.count).toBeGreaterThan(0);
  });

  it("counts the emphasis that flattens to plain text", () => {
    expect(named("Emphasis")?.count).toBeGreaterThan(0);
  });

  it("says nothing about what this resume does not have", () => {
    expect(losses.every((loss) => loss.count > 0)).toBe(true);

    const empty = lossOf(
      {
        ...FIXTURE_DOCUMENT,
        header: { fullName: "Ada Lovelace", contacts: [] },
        sections: [],
        meta: { ...FIXTURE_DOCUMENT.meta, templateId: undefined },
      },
      "jsonresume",
    );
    expect(empty).toEqual([]);
  });

  it("does not claim a heading was renamed when it was not", () => {
    const asWritten: ResumeDocument = {
      ...FIXTURE_DOCUMENT,
      sections: FIXTURE_DOCUMENT.sections.map((section) => ({ ...section, heading: "Work" })),
    };
    const loss = lossOf(asWritten, "jsonresume").find((row) => row.what === "Headings you chose");

    // Only the experience section is called "work" over there, and a custom
    // section has no list to be renamed into in the first place.
    const mappable = FIXTURE_DOCUMENT.sections.filter((row) => row.kind !== "custom").length;
    expect(loss?.count).toBe(mappable - 1);
  });
});
