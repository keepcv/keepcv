import type { RichText } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { projectPlainText } from "./plain-text.js";
import { deriveRevision } from "./revision.js";

describe("deriveRevision", () => {
  it("stores the body it hashed, not the one it was given", () => {
    const derived = deriveRevision([
      { t: "text", v: "Shipped " },
      { t: "text", v: "the engine" },
    ]);
    expect(derived.body).toEqual([{ t: "text", v: "Shipped the engine" }]);
    expect(derived.plainText).toBe("Shipped the engine");
  });

  // I3 rests on this: two bodies that render the same text must reach the same
  // hash, or retyping a word and undoing it appends a revision that says nothing.
  it("gives two spellings of one body the same hash", () => {
    const split: RichText = [
      { t: "b", c: [{ t: "text", v: "Shipped" }] },
      { t: "b", c: [{ t: "text", v: " the engine" }] },
    ];
    const merged: RichText = [{ t: "b", c: [{ t: "text", v: "Shipped the engine" }] }];
    expect(deriveRevision(split).contentHash).toBe(deriveRevision(merged).contentHash);
  });

  it("gives different text different hashes", () => {
    const a = deriveRevision([{ t: "text", v: "Shipped the engine" }]);
    const b = deriveRevision([{ t: "text", v: "Shipped an engine" }]);
    expect(a.contentHash).not.toBe(b.contentHash);
  });

  // Formatting is part of the text, even though the plain-text projection cannot
  // see it: bolding a word is an edit worth keeping.
  it("distinguishes bodies that share a plain-text projection", () => {
    const plain = deriveRevision([{ t: "text", v: "Shipped" }]);
    const bold = deriveRevision([{ t: "b", c: [{ t: "text", v: "Shipped" }] }]);
    expect(plain.plainText).toBe(bold.plainText);
    expect(plain.contentHash).not.toBe(bold.contentHash);
  });

  it("counts code points, so an astral character is one character", () => {
    expect(deriveRevision([{ t: "text", v: "a\u{1f680}b" }]).charCount).toBe(3);
  });

  // I8, at the one place that can break it.
  it.each([
    [[]],
    [[{ t: "text", v: "" }]],
    [[{ t: "a", href: "https://example.com", c: [{ t: "text", v: "the paper" }] }]],
  ] as [RichText][])("keeps plainText the projection of body for %j", (body) => {
    const derived = deriveRevision(body);
    expect(derived.plainText).toBe(projectPlainText(derived.body));
    expect(derived.charCount).toBe([...derived.plainText].length);
  });
});
