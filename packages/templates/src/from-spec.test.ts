import { templateFileSchema, templateSpecSchema } from "@keepcv/schema";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { atsLeftHeading, atsSingleColumn, BLANK_SPEC } from "./built-in.js";
import { FIXTURE_DOCUMENT } from "./fixture.js";
import { fromSpec } from "./from-spec.js";
import { DESIGN_KNOBS, FIT_KNOBS } from "./knobs.js";
import { resolveTemplate } from "./registry.js";

const made = (settings: Record<string, string | number>) =>
  fromSpec("mine", "Mine", { settings, extraCss: "" });

describe("a template built from a design", () => {
  it("takes its own value for a knob it sets and the catalogue's for one it does not", () => {
    const template = made({ nameSize: 2.4 });

    expect(template.defaultConfig["nameSize"]).toBe(2.4);
    expect(template.defaultConfig["bullet"]).toBe("dash");
  });

  it("offers a resume the fit knobs and none of the design ones", () => {
    const keys = made({}).fields.map((field) => field.key);

    expect(keys).toEqual(FIT_KNOBS.map((field) => field.key));
    for (const design of DESIGN_KNOBS) expect(keys).not.toContain(design.key);
  });

  it("keeps a design knob where the design put it when a resume names it", () => {
    const template = made({ headingPlace: "beside" });
    const config = { ...template.defaultConfig, headingPlace: "above" };

    expect(template.styles(config)).toContain("grid-template-columns");
  });

  it("leaves a knob at the catalogue's value when the design names one it does not offer", () => {
    expect(made({ bullet: "sparkles" }).defaultConfig["bullet"]).toBe("dash");
  });

  it("uses a custom accent ahead of a preset and falls back for invalid CSS values", () => {
    const custom = made({ accent: "forest", accentColor: "#284766" });
    expect(custom.styles(custom.defaultConfig)).toContain("color: #284766;");
    expect(custom.styles({ ...custom.defaultConfig, accentColor: "#ffffff" })).toContain(
      "color: #284766;",
    );
    const invalid = made({ accent: "forest", accentColor: "red; display: none" });
    expect(invalid.defaultConfig["accentColor"]).toBe("");
    expect(invalid.styles(invalid.defaultConfig)).toContain("color: #1f4d38;");
    expect(invalid.styles(invalid.defaultConfig)).not.toContain("display: none");
  });

  it("renders heading size and entry and point spacing from the saved design", () => {
    const custom = made({ headingSize: 1.2, entryGap: 9, pointGap: 3 });
    const css = custom.styles(custom.defaultConfig);
    expect(css).toContain("font-size: 1.2em;");
    expect(css).toContain(".kc-entry { margin-top: 9pt;");
    expect(css).toContain(".kc-points li { margin-top: 3pt;");
    expect(made({ entryGap: 999, pointGap: -2, headingSize: 9 }).defaultConfig).toMatchObject({
      entryGap: 5,
      pointGap: 1.5,
      headingSize: 0.9,
    });
  });

  it("says so in the notes when the design carries CSS of its own", () => {
    const plain = fromSpec("a", "A", BLANK_SPEC);
    const extra = fromSpec("b", "B", { settings: {}, extraCss: ".kc-name { color: #333; }" });

    expect(extra.complianceNotes.length).toBe(plain.complianceNotes.length + 1);
    expect(extra.complianceNotes.at(-1)).toContain("extra CSS");
  });

  it("writes that CSS into the stylesheet it hands out", () => {
    const template = fromSpec("b", "B", { settings: {}, extraCss: ".kc-name { color: #333; }" });

    expect(template.styles(template.defaultConfig)).toContain(".kc-name { color: #333; }");
  });
});

describe("what a design may not carry", () => {
  it.each([
    ["@import url(x.css);", "an import"],
    [".kc-doc { background: url(https://example.test/a.png); }", "an address"],
    ["</style><script>alert(1)</script>", "a closing tag"],
  ])("refuses %s", (extraCss) => {
    expect(
      templateFileSchema.safeParse({ name: "Design", spec: { settings: {}, extraCss } }).success,
    ).toBe(false);
  });

  it("accepts a data: address, which fetches nothing", () => {
    const extraCss = '.kc-doc { background: url("data:image/gif;base64,R0lGOD"); }';

    expect(
      templateFileSchema.safeParse({ name: "Design", spec: { settings: {}, extraCss } }).success,
    ).toBe(true);
  });

  it("preserves an older design but omits its unsafe CSS when rendering", () => {
    const extraCss = '.kc-name { background: image-set("https://example.test/a" 1x); }';
    const spec = templateSpecSchema.parse({ settings: {}, extraCss });
    const template = fromSpec("old", "Old", spec);
    expect(spec.extraCss).toBe(extraCss);
    expect(template.styles(template.defaultConfig)).not.toContain("example.test");
    expect(template.complianceNotes.at(-1)).toContain("omitted");
  });
});

describe("the design a document carries", () => {
  const spec = { settings: { nameSize: 2.55 }, extraCss: "" };

  it("is used ahead of the id, so editing the row cannot rewrite what a version printed", () => {
    const { template, config } = resolveTemplate({
      ...FIXTURE_DOCUMENT,
      meta: {
        ...FIXTURE_DOCUMENT.meta,
        templateId: "ats-single-column",
        templateName: "As it was in March",
        templateSpec: spec,
      },
    });

    expect(template.name).toBe("As it was in March");
    expect(config["nameSize"]).toBe(2.55);
  });

  it("still lets the resume's own fit settings through", () => {
    const { config } = resolveTemplate({
      ...FIXTURE_DOCUMENT,
      meta: {
        ...FIXTURE_DOCUMENT.meta,
        templateSpec: spec,
        templateConfig: { pageSize: "letter" },
      },
    });

    expect(config["pageSize"]).toBe("letter");
  });
});

describe("the shipped designs", () => {
  it("put their headings in different places", () => {
    expect(atsSingleColumn.styles(atsSingleColumn.defaultConfig)).not.toContain(
      "grid-template-columns",
    );
    expect(atsLeftHeading.styles(atsLeftHeading.defaultConfig)).toContain("grid-template-columns");
  });

  it("arrange an entry's dates differently", () => {
    const single = renderToStaticMarkup(
      atsSingleColumn.render(FIXTURE_DOCUMENT, atsSingleColumn.defaultConfig),
    );
    const left = renderToStaticMarkup(
      atsLeftHeading.render(FIXTURE_DOCUMENT, atsLeftHeading.defaultConfig),
    );

    expect(single).toContain("kc-row");
    expect(left).not.toContain("kc-row");
  });
});
