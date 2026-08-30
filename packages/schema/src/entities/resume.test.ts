import { describe, expect, it } from "vitest";
import { CAREER_RECORD_KINDS } from "./career-record.js";
import { resumeInputSchema, resumePatchSchema, SECTION_KINDS } from "./resume.js";

describe("section kinds", () => {
  // A record kind with no section to print under would be invisible on every
  // resume, and a section with no records to fill it would always be empty.
  it("covers every record kind, with custom_entry reading as its heading", () => {
    const expected = CAREER_RECORD_KINDS.map((kind) =>
      kind === "custom_entry" ? "custom" : kind,
    ).sort();

    expect([...SECTION_KINDS].sort()).toEqual(expected);
  });
});

describe("patching a resume", () => {
  // A field with a `.default()` survives `.partial()`, so an absent key parses
  // to the default and the write resets it. Renaming used to clear the
  // template.
  it("carries only the fields it was given", () => {
    expect(resumePatchSchema.parse({ name: "Backend, Acme" })).toEqual({ name: "Backend, Acme" });
    expect(resumePatchSchema.parse({})).toEqual({});
  });

  it("still fills the defaults on a create, where absent does mean none", () => {
    const created = resumeInputSchema.parse({
      id: "01a024f1-5b16-7a33-88b0-9566df57109e",
      name: "Backend, Acme",
      targetCompany: null,
      targetRole: null,
      targetUrl: null,
      targetJdText: null,
      appliedOn: null,
    });

    expect(created).toMatchObject({ templateId: null, templateConfig: {}, pageLimit: null });
  });
});
