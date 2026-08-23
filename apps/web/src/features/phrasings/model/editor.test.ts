import { newUuid } from "@keepcv/core";
import { draftSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { addPhrasing, addPoint, emptyStore } from "../../../store.harness.js";
import {
  actionFor,
  bodyOf,
  buildVariant,
  canonicalPhrasing,
  draftTarget,
  draftText,
} from "./editor.js";

const EPOCH = "2026-01-01T00:00:00.000Z";

function aDraft(body: unknown) {
  return draftSchema.parse({
    ...draftTarget(newUuid()),
    createdAt: EPOCH,
    updatedAt: EPOCH,
    body,
  });
}

describe("the editor's transitions", () => {
  const typed = "Cut p95 latency to 120ms";
  const committed = "Cut p95 latency";

  it("keeps a keystroke out of history and a settle out of the draft table", () => {
    expect(actionFor({ typed, committed, hasDraft: false }, "debounce")).toBe("save-draft");
    expect(actionFor({ typed, committed, hasDraft: false }, "settle")).toBe("commit");
  });

  // A history of 400 single-character revisions is not history, and a draft
  // that outlives the text it differed from would offer to restore what is
  // already there.
  it("throws the draft away rather than appending when the words come back", () => {
    expect(actionFor({ typed: committed, committed, hasDraft: true }, "settle")).toBe(
      "discard-draft",
    );
    expect(actionFor({ typed: `  ${committed}  `, committed, hasDraft: true }, "debounce")).toBe(
      "discard-draft",
    );
    expect(actionFor({ typed: committed, committed, hasDraft: false }, "settle")).toBe("none");
  });
});

describe("a drafted body", () => {
  it("survives the round trip through the draft table", () => {
    expect(draftText(aDraft({ body: bodyOf("  a wording  ") }))).toBe("a wording");
  });

  // A draft is deliberately unvalidated, so an older shape has to read as no
  // draft rather than as a crash on the screen that opens it.
  it("reads a body this build does not understand as nothing waiting", () => {
    expect(draftText(undefined)).toBeUndefined();
    expect(draftText(aDraft({ body: "plain" }))).toBeUndefined();
    expect(draftText(aDraft({}))).toBeUndefined();
  });
});

describe("a new wording", () => {
  it("starts from the one it varies and goes last in the set", () => {
    const store = emptyStore();
    const point = addPoint(store, "Cut p95 latency");
    addPhrasing(store, point.phrasingSetId, "Cut latency", { sortKey: "a1" });

    const input = buildVariant(store, {
      phrasingSetId: point.phrasingSetId,
      variant: "short",
      label: "  for infra roles  ",
      text: "Cut latency",
    });

    expect(input.body).toEqual([{ t: "text", v: "Cut latency" }]);
    expect(input.label).toBe("for infra roles");
    expect(input.sortKey > "a1").toBe(true);
  });

  it("stores an unlabelled wording as absent rather than as an empty string", () => {
    const store = emptyStore();
    const point = addPoint(store, "Cut p95 latency");
    const input = buildVariant(store, {
      phrasingSetId: point.phrasingSetId,
      variant: "long",
      label: "   ",
      text: "Cut p95 latency across forty services",
    });

    expect(input.label).toBeNull();
  });
});

describe("the canonical wording", () => {
  it("is the one the set points at, not the first one written", () => {
    const store = emptyStore();
    const point = addPoint(store, "Cut p95 latency");
    const short = addPhrasing(store, point.phrasingSetId, "Cut latency", { sortKey: "a1" });

    expect(canonicalPhrasing(store, point.phrasingSetId)?.id).not.toBe(short.id);

    const set = store.phrasingSets.find((row) => row.id === point.phrasingSetId);
    if (set !== undefined) set.canonicalPhrasingId = short.id;
    expect(canonicalPhrasing(store, point.phrasingSetId)?.id).toBe(short.id);
  });
});
