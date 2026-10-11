import { newUuid } from "@keepcv/core";
import type { Evidence, Uuid } from "@keepcv/schema";
import { evidenceSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { buildEvidence, hrefOf } from "./evidence-form.js";

const anEvidence = (kind: string, value: string): Evidence =>
  evidenceSchema.parse({
    id: newUuid(),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    archivedAt: null,
    pointId: newUuid(),
    kind,
    value,
    note: null,
  });

describe("building an evidence row", () => {
  const pointId = newUuid() as Uuid;

  it("trims the value and drops an empty note", () => {
    const built = buildEvidence(pointId, { kind: "url", value: "  https://x.test  ", note: "  " });

    if (!("evidence" in built)) throw new Error("expected a row, got errors");
    expect(built.evidence).toMatchObject({
      pointId,
      kind: "url",
      value: "https://x.test",
      note: null,
    });
  });

  // The store requires a value, so the form has to say so rather than sending a
  // row the API answers with a 422.
  it("refuses a value that is only whitespace", () => {
    const built = buildEvidence(pointId, { kind: "note", value: "   ", note: "" });

    expect(built).toHaveProperty("errors.value");
  });
});

describe("whether a piece of evidence is a link", () => {
  it("opens an http and an https address", () => {
    expect(hrefOf(anEvidence("url", "https://x.test/pr/1"))).toBe("https://x.test/pr/1");
    expect(hrefOf(anEvidence("url", "http://x.test/"))).toBe("http://x.test/");
  });

  // A path, a half-typed address or a `javascript:` string is still the user's
  // note to themselves: it is shown as text rather than turned into an anchor.
  it("shows anything else as text", () => {
    expect(hrefOf(anEvidence("url", "x.test/pr/1"))).toBeUndefined();
    expect(hrefOf(anEvidence("url", "javascript:alert(1)"))).toBeUndefined();
    expect(hrefOf(anEvidence("file", "~/records/review.pdf"))).toBeUndefined();
    expect(hrefOf(anEvidence("note", "https://x.test"))).toBeUndefined();
  });
});
