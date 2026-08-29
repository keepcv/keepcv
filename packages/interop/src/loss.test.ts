import type { ResumeDocument } from "@keepcv/schema";
import { FIXTURE_DOCUMENT } from "@keepcv/templates";
import { describe, expect, it } from "vitest";
import { EXPORT_TARGETS, lossOf } from "./loss.js";

const DESIGNED: ResumeDocument = {
  ...FIXTURE_DOCUMENT,
  meta: { ...FIXTURE_DOCUMENT.meta, templateId: "ats-classic", templateName: "ATS classic" },
};

describe("what a typeset file does not carry", () => {
  it("names the design, because the file sets itself", () => {
    const loss = lossOf(DESIGNED, "latex").find((row) => row.what === "The design you chose");

    expect(loss?.count).toBe(1);
    expect(loss?.detail).toContain("ATS classic");
  });

  it("names the section layouts it writes as plain lists", () => {
    const loss = lossOf(DESIGNED, "typst").find((row) => row.what === "Section layouts");

    expect(loss?.count).toBe(2);
    expect(loss?.detail).toContain("run together on one line");
    expect(loss?.detail).toContain("stacked under one employer");
  });

  it("answers the same for every format that lays itself out", () => {
    expect(lossOf(DESIGNED, "typst")).toEqual(lossOf(DESIGNED, "latex"));
    expect(lossOf(DESIGNED, "docx")).toEqual(lossOf(DESIGNED, "latex"));
  });

  // A standing disclaimer is one nobody reads, so a resume that loses nothing
  // has to say nothing.
  it("says nothing about a resume it costs nothing", () => {
    const plain: ResumeDocument = {
      ...FIXTURE_DOCUMENT,
      meta: { ...FIXTURE_DOCUMENT.meta, templateId: undefined },
      sections: FIXTURE_DOCUMENT.sections.map((section) => ({ ...section, layout: "entries" })),
    };

    expect(lossOf(plain, "latex")).toEqual([]);
  });

  it("answers every target it declares", () => {
    for (const target of EXPORT_TARGETS) {
      expect(Array.isArray(lossOf(DESIGNED, target))).toBe(true);
    }
  });
});
