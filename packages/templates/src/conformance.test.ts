import type { Inline } from "@keepcv/schema";
import { RECORD_FIELD_VALUE_KINDS, resumeDocumentSchema, SECTION_LAYOUTS } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { isATemplate } from "./conformance.harness.js";
import { FIXTURE_DOCUMENT } from "./fixture.js";
import { TEMPLATES } from "./registry.js";

const entries = FIXTURE_DOCUMENT.sections.flatMap((section) => section.entries);
const points = entries.flatMap((entry) => entry.points);

function marks(nodes: readonly Inline[]): string[] {
  return nodes.flatMap((node) => (node.t === "text" ? [] : [node.t, ...marks(node.c)]));
}

// A template only proves as much as the fixture asks of it, so trimming the
// fixture is the failure these guard.
describe("the shared fixture", () => {
  it("is a document the wire format would accept", () => {
    expect(resumeDocumentSchema.parse(FIXTURE_DOCUMENT)).toEqual(FIXTURE_DOCUMENT);
  });

  it("carries every layout, every field kind and every inline mark", () => {
    const layouts = new Set(FIXTURE_DOCUMENT.sections.map((section) => section.layout));
    const kinds = new Set(entries.flatMap((entry) => entry.fields.map((field) => field.kind)));
    const used = new Set([
      ...marks(FIXTURE_DOCUMENT.header.summary ?? []),
      ...points.flatMap((point) => marks(point.text)),
    ]);

    expect([...layouts].sort()).toEqual([...SECTION_LAYOUTS].sort());
    expect([...kinds].sort()).toEqual([...RECORD_FIELD_VALUE_KINDS].sort());
    expect([...used].sort()).toEqual(["a", "b", "i"]);
  });

  it("carries the awkward cases a template has to survive", () => {
    const grouped = FIXTURE_DOCUMENT.sections.find((section) => section.layout === "grouped");
    const claimed = new Set(grouped?.groups?.flatMap((group) => group.entryKeys));

    expect(FIXTURE_DOCUMENT.sections.some((section) => section.entries.length === 0)).toBe(true);
    expect(entries.some((entry) => entry.points.length === 0)).toBe(true);
    expect(points.some((point) => point.metrics.length === 0)).toBe(true);
    expect(grouped?.entries.some((entry) => !claimed.has(entry.key))).toBe(true);
  });
});

for (const template of TEMPLATES) {
  describe(template.id, () => {
    isATemplate(template);
  });
}
