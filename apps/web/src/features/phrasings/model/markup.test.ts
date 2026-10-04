import { deriveRevision, projectPlainText } from "@keepcv/core";
import type { RichText } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { editBody, markBody } from "./markup.js";

const formatted: RichText = [
  { t: "b", c: [{ t: "text", v: "Led" }] },
  { t: "text", v: " the " },
  { t: "a", href: "https://example.test", c: [{ t: "i", c: [{ t: "text", v: "project" }] }] },
];

describe("editing a phrasing AST", () => {
  it("keeps existing marks and links when text is appended or replaced", () => {
    const appended = editBody(formatted, "Led the project successfully");
    expect(appended[0]).toEqual(formatted[0]);
    expect(appended[2]).toMatchObject({ t: "a", href: "https://example.test" });
    const replacement = editBody(formatted, "Ran the project", { start: 0, end: 3 });
    expect(replacement[0]).toEqual({ t: "b", c: [{ t: "text", v: "Ran" }] });
    expect(replacement[2]).toEqual(formatted[2]);
  });
  it("uses the selected occurrence when repeated text has different formatting", () => {
    const body: RichText = [
      { t: "text", v: "aa" },
      { t: "b", c: [{ t: "text", v: "aa" }] },
    ];
    expect(editBody(body, "aaa", { start: 0, end: 1 })).toEqual([{ t: "text", v: "a" }, body[1]]);
  });
  it("formats only the selection and can toggle or clear overlapping marks", () => {
    const bold = markBody([{ t: "text", v: "one two" }], 4, 7, { t: "b" });
    expect(bold).toEqual([
      { t: "text", v: "one " },
      { t: "b", c: [{ t: "text", v: "two" }] },
    ]);
    expect(markBody(bold, 4, 7, { t: "b" })).toEqual([{ t: "text", v: "one two" }]);
    const all = markBody(markBody(bold, 4, 7, { t: "i" }), 4, 7, {
      t: "a",
      href: "mailto:ada@example.test",
    });
    expect(projectPlainText(all)).toBe("one two");
    expect(markBody(all, 4, 7, "clear")).toEqual([{ t: "text", v: "one two" }]);
  });
  it("replaces links without nesting and refuses unsafe destinations", () => {
    const replacement = markBody(formatted, 8, 15, { t: "a", href: "https://other.test" });
    expect(JSON.stringify(replacement).match(/"t":"a"/g)).toHaveLength(1);
    expect(() => markBody(formatted, 8, 15, { t: "a", href: "javascript:alert(1)" })).toThrow(
      /http, https or mailto/,
    );
  });
  it("treats pasted markup as text and retains formatting in revision identity", () => {
    const pasted = editBody(formatted, "Led the project <script>\nnext");
    expect(projectPlainText(pasted)).toBe("Led the project <script> next");
    const plain: RichText = [{ t: "text", v: "Led the project" }];
    expect(deriveRevision(plain).plainText).toBe(deriveRevision(formatted).plainText);
    expect(deriveRevision(plain).contentHash).not.toBe(deriveRevision(formatted).contentHash);
  });
});
