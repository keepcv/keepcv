import { describe, expect, it } from "vitest";
import { atsSingleColumn } from "./ats-single-column/index.js";
import { configFor } from "./contract.js";
import { FIXTURE_DOCUMENT } from "./fixture.js";
import { DEFAULT_TEMPLATE_ID, resolveTemplate, templateById } from "./registry.js";

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
