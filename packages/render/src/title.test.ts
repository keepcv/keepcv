import type { ResumeDocument } from "@keepcv/schema";
import { FIXTURE_DOCUMENT } from "@keepcv/templates";
import { describe, expect, it } from "vitest";
import { documentTitle, fileNameFor } from "./title.js";

const asked = (header: Partial<ResumeDocument["header"]>, resumeName = "Staff engineer, 2026") =>
  ({
    ...FIXTURE_DOCUMENT,
    meta: { ...FIXTURE_DOCUMENT.meta, resumeName },
    header: { ...FIXTURE_DOCUMENT.header, ...header },
  }) satisfies ResumeDocument;

describe("what an exported resume is called", () => {
  it("names the person and the resume", () => {
    expect(documentTitle(asked({}))).toBe("Ada Lovelace - Staff engineer, 2026");
  });

  it("falls back to the resume alone when the profile has no name yet", () => {
    expect(documentTitle(asked({ fullName: undefined }))).toBe("Staff engineer, 2026");
    expect(documentTitle(asked({ fullName: "  " }))).toBe("Staff engineer, 2026");
  });

  it("files it under a name every filesystem accepts", () => {
    expect(fileNameFor(asked({}), "html")).toBe("ada-lovelace-staff-engineer-2026.html");
    expect(fileNameFor(asked({ fullName: "Andr\u00e9 Le\u00f3n" }), "html")).toBe(
      "andre-leon-staff-engineer-2026.html",
    );
  });

  // Without the fallback the download is a dotfile called ".html".
  it("still answers with a name when nothing survives slugging", () => {
    expect(fileNameFor(asked({ fullName: undefined }, "!!!"), "html")).toBe("resume.html");
  });
});
