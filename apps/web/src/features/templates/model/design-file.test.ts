import type { TemplateSpec } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { designFile, designFileName, readDesign } from "./design-file.js";

const spec: TemplateSpec = {
  settings: { accent: "navy", headingPlace: "beside", nameSize: 2.1 },
  extraCss: ".kc-name { letter-spacing: 0; }",
};

describe("a design as a file", () => {
  it("reads back what it wrote", async () => {
    const answer = readDesign(await designFile("Navy headings", spec).text());

    expect(answer).toEqual({ design: { name: "Navy headings", spec } });
  });

  it("names the file after the design, and never after nothing", () => {
    expect(designFileName("Navy headings")).toBe("navy-headings.keepcv-template.json");
    expect(designFileName("  ...  ")).toBe("design.keepcv-template.json");
  });

  // The refusal is the schema's, so a design edited by hand is turned away
  // before it is written rather than after it has printed offline.
  it("refuses a stylesheet that fetches, and says what to take out", () => {
    const fetching = { name: "Webfont", spec: { settings: {}, extraCss: "@import url(a.css);" } };
    const answer = readDesign(JSON.stringify(fetching));

    if (!("problem" in answer)) throw new Error("a stylesheet that fetches is refused");
    expect(answer.problem).toMatch(/may not fetch anything/);
  });

  it("turns away anything that is not a design", () => {
    const notADesign = 'That is not a design. "Save it as a file" on a design writes one.';

    expect(readDesign("{")).toEqual({ problem: notADesign });
    expect(readDesign('{"basics":{"name":"Ada"}}')).toEqual({ problem: notADesign });
    expect(readDesign('{"name":"Navy","spec":{"settings":{}}}')).toEqual({ problem: notADesign });
  });
});
