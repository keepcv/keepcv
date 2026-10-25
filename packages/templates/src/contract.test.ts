import { describe, expect, it } from "vitest";
import { atsSingleColumn } from "./built-in.js";
import { configFor } from "./contract.js";
import { FIXTURE_DOCUMENT } from "./fixture.js";
import { DEFAULT_TEMPLATE_ID, resolveTemplate, TEMPLATES, templateById } from "./registry.js";

describe("a stored configuration", () => {
  it("takes the declared default for a key it does not hold", () => {
    expect(configFor(atsSingleColumn, { fontSize: 12 })).toEqual({
      ...atsSingleColumn.defaultConfig,
      fontSize: 12,
    });
  });

  it("drops a key the template no longer declares", () => {
    expect(configFor(atsSingleColumn, { retiredInVersionTwo: "x" })).toEqual(
      atsSingleColumn.defaultConfig,
    );
  });

  it("refuses a value outside what the field offers", () => {
    const wild = configFor(atsSingleColumn, {
      fontSize: 400,
      lineHeight: Number.NaN,
      fontFamily: "comic-sans",
    });

    expect(wild).toEqual(atsSingleColumn.defaultConfig);
  });

  it("refuses a value of the wrong type", () => {
    expect(configFor(atsSingleColumn, { fontSize: "10.5", pageSize: 4 })).toEqual(
      atsSingleColumn.defaultConfig,
    );
  });
});

describe("resolving the template a document names", () => {
  it("offers nine system designs while preserving historical ids and the missing-id fallback", () => {
    expect(TEMPLATES).toHaveLength(9);
    expect(new Set(TEMPLATES.map((template) => template.id)).size).toBe(9);
    expect(TEMPLATES.some((template) => template.id === "ats-single-column")).toBe(false);
    expect(resolveTemplate(FIXTURE_DOCUMENT).template.id).toBe("ats-single-column");
    expect(templateById("ats-left-heading")?.defaultConfig["headingAlign"]).toBe("right");
    expect(templateById("left-headings-v2")?.defaultConfig["headingAlign"]).toBe("left");
  });
  it("takes the one it names, configured as it says", () => {
    const { template, config } = resolveTemplate({
      ...FIXTURE_DOCUMENT,
      meta: {
        ...FIXTURE_DOCUMENT.meta,
        templateId: DEFAULT_TEMPLATE_ID,
        templateConfig: { pageSize: "letter" },
      },
    });

    expect(template.id).toBe(DEFAULT_TEMPLATE_ID);
    expect(config["pageSize"]).toBe("letter");
  });

  // A resume that will not print is the one thing this product may not produce.
  it("falls back rather than refusing when the build has no such template", () => {
    const { template, config } = resolveTemplate({
      ...FIXTURE_DOCUMENT,
      meta: { ...FIXTURE_DOCUMENT.meta, templateId: "written-in-2031", templateConfig: { a: 1 } },
    });

    expect(template.id).toBe(DEFAULT_TEMPLATE_ID);
    expect(config).toEqual(template.defaultConfig);
    expect(templateById("written-in-2031")).toBeUndefined();
  });

  it("falls back when the document names none", () => {
    expect(resolveTemplate(FIXTURE_DOCUMENT).template.id).toBe(DEFAULT_TEMPLATE_ID);
  });
});
