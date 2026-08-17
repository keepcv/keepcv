import { describe, expect, it } from "vitest";
import { CAREER_RECORD_KINDS } from "./career-record.js";
import { SECTION_KINDS } from "./resume.js";

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
