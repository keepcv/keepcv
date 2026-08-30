import { type Inline, richTextSchema } from "@keepcv/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canonicaliseRichText } from "./canonicalise.js";
import { projectPlainText } from "./plain-text.js";

// Only bodies richTextSchema accepts: straying outside makes the
// "canonicalising keeps it valid" property vacuous.
function bodies(depth: number, allowLink: boolean): fc.Arbitrary<Inline[]> {
  const text = fc.record({ t: fc.constant("text" as const), v: fc.string({ maxLength: 3 }) });
  if (depth === 0) return fc.array(text, { maxLength: 4 });

  const children = bodies(depth - 1, allowLink);
  const marks: fc.Arbitrary<Inline>[] = [
    fc.record({ t: fc.constant("b" as const), c: children }),
    fc.record({ t: fc.constant("i" as const), c: children }),
  ];
  if (allowLink) {
    marks.push(
      fc.record({
        t: fc.constant("a" as const),
        href: fc.constantFrom("https://one.example", "https://two.example"),
        c: bodies(depth - 1, false),
      }),
    );
  }
  return fc.array(fc.oneof(text, ...marks), { maxLength: 4 });
}

const anyBody = bodies(3, true);

describe("canonicaliseRichText", () => {
  it("merges adjacent text nodes", () => {
    expect(
      canonicaliseRichText([
        { t: "text", v: "Cut p95 " },
        { t: "text", v: "latency" },
      ]),
    ).toEqual([{ t: "text", v: "Cut p95 latency" }]);
  });

  it("drops empty text nodes", () => {
    expect(
      canonicaliseRichText([
        { t: "text", v: "" },
        { t: "text", v: "kept" },
        { t: "text", v: "" },
      ]),
    ).toEqual([{ t: "text", v: "kept" }]);
  });

  it("drops marks left with no content", () => {
    expect(
      canonicaliseRichText([
        { t: "b", c: [{ t: "text", v: "" }] },
        { t: "i", c: [] },
        { t: "text", v: "kept" },
      ]),
    ).toEqual([{ t: "text", v: "kept" }]);
  });

  it("merges adjacent identical marks", () => {
    expect(
      canonicaliseRichText([
        { t: "b", c: [{ t: "text", v: "180" }] },
        { t: "b", c: [{ t: "text", v: "ms" }] },
      ]),
    ).toEqual([{ t: "b", c: [{ t: "text", v: "180ms" }] }]);
  });

  it("keeps adjacent links apart unless they point at the same href", () => {
    const differentHrefs: Inline[] = [
      { t: "a", href: "https://one.example", c: [{ t: "text", v: "one" }] },
      { t: "a", href: "https://two.example", c: [{ t: "text", v: "two" }] },
    ];
    expect(canonicaliseRichText(differentHrefs)).toEqual(differentHrefs);

    expect(
      canonicaliseRichText([
        { t: "a", href: "https://one.example", c: [{ t: "text", v: "one" }] },
        { t: "a", href: "https://one.example", c: [{ t: "text", v: "two" }] },
      ]),
    ).toEqual([{ t: "a", href: "https://one.example", c: [{ t: "text", v: "onetwo" }] }]);
  });

  it("unwraps a mark nested directly inside the same mark", () => {
    expect(canonicaliseRichText([{ t: "b", c: [{ t: "b", c: [{ t: "text", v: "x" }] }] }])).toEqual(
      [{ t: "b", c: [{ t: "text", v: "x" }] }],
    );
  });

  it("leaves different marks nested", () => {
    const nested: Inline[] = [{ t: "b", c: [{ t: "i", c: [{ t: "text", v: "x" }] }] }];
    expect(canonicaliseRichText(nested)).toEqual(nested);
  });

  it("merges text that only becomes adjacent once its marks are merged", () => {
    expect(
      canonicaliseRichText([
        { t: "b", c: [{ t: "text", v: "a" }] },
        {
          t: "b",
          c: [
            { t: "text", v: "b" },
            { t: "text", v: "" },
            { t: "i", c: [] },
          ],
        },
      ]),
    ).toEqual([{ t: "b", c: [{ t: "text", v: "ab" }] }]);
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(anyBody, (body) => {
        const once = canonicaliseRichText(body);
        expect(canonicaliseRichText(once)).toEqual(once);
      }),
    );
  });

  it("never changes the plain-text projection", () => {
    fc.assert(
      fc.property(anyBody, (body) => {
        expect(projectPlainText(canonicaliseRichText(body))).toBe(projectPlainText(body));
      }),
    );
  });

  it("produces a body the schema still accepts", () => {
    fc.assert(
      fc.property(anyBody, (body) => {
        expect(richTextSchema.safeParse(body).success).toBe(true);
        expect(richTextSchema.safeParse(canonicaliseRichText(body)).success).toBe(true);
      }),
    );
  });
});
