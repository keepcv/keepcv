import { describe, expect, it } from "vitest";
import { projectPlainText } from "./plain-text.js";

describe("projectPlainText", () => {
  it("is empty for an empty body", () => {
    expect(projectPlainText([])).toBe("");
  });

  it("concatenates text across marks without adding separators", () => {
    expect(
      projectPlainText([
        { t: "text", v: "Cut p95 latency to " },
        { t: "b", c: [{ t: "text", v: "180ms" }] },
        { t: "text", v: "." },
      ]),
    ).toBe("Cut p95 latency to 180ms.");
  });

  it("takes a link's text and not its href", () => {
    expect(
      projectPlainText([
        { t: "a", href: "https://example.com/rfc", c: [{ t: "text", v: "the proposal" }] },
      ]),
    ).toBe("the proposal");
  });

  it("descends through nested marks", () => {
    expect(
      projectPlainText([
        {
          t: "b",
          c: [
            { t: "i", c: [{ t: "text", v: "deep" }] },
            { t: "text", v: "er" },
          ],
        },
      ]),
    ).toBe("deeper");
  });
});
