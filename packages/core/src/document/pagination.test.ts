import { describe, expect, it } from "vitest";
import {
  anEntry,
  anEntryPoint,
  anOrganisation,
  aPoint,
  aRecord,
  aResume,
  aSection,
  emptyStore,
} from "../store/store.harness.js";
import { compile } from "./compile.js";
import { type FlowBlock, lengthBudget, paginate } from "./pagination.js";

function aBlock(
  key: string,
  top: number,
  height: number,
  extra: Partial<FlowBlock> = {},
): FlowBlock {
  return { key, top, height, atomic: false, keepWithNext: false, covers: [], ...extra };
}

// A column of `count` blocks of `height`, laid out one after another.
function aColumn(count: number, height: number, extra: Partial<FlowBlock> = {}): FlowBlock[] {
  return Array.from({ length: count }, (_, index) =>
    aBlock(`b${String(index)}`, index * height, height, extra),
  );
}

describe("filling pages from a laid-out column", () => {
  it("is one page when the column is shorter than one", () => {
    const filled = paginate(aColumn(3, 100), 1000);

    expect(filled.pages).toBe(1);
    expect(filled.breaks).toEqual([]);
    expect(filled.pageOf).toEqual({ b0: 1, b1: 1, b2: 1 });
  });

  it("is one page when nothing has been measured yet", () => {
    expect(paginate(aColumn(3, 100), 0).pages).toBe(1);
  });

  it("counts a page for every boundary the column crosses", () => {
    const filled = paginate(aColumn(10, 100), 400);

    expect(filled.pages).toBe(3);
    expect(filled.pageOf["b3"]).toBe(1);
    expect(filled.pageOf["b4"]).toBe(2);
    expect(filled.pageOf["b9"]).toBe(3);
  });

  it("lets a block that may be broken straddle the boundary", () => {
    const filled = paginate([aBlock("a", 0, 90), aBlock("b", 90, 30)], 100);

    expect(filled.pages).toBe(2);
    expect(filled.pageOf).toEqual({ a: 1, b: 1 });
    expect(filled.breaks).toEqual([100]);
  });

  it("moves a block that may not be broken, and everything after it", () => {
    const filled = paginate(
      [aBlock("a", 0, 90), aBlock("b", 90, 30, { atomic: true }), aBlock("c", 120, 10)],
      100,
    );

    expect(filled.pageOf).toEqual({ a: 1, b: 2, c: 2 });
    // Drawn where the moved block starts, not at the page height, because the
    // column the preview shows is the unbroken one.
    expect(filled.breaks).toEqual([90]);
    expect(filled.pages).toBe(2);
  });

  it("leaves a block taller than a page where it is", () => {
    const filled = paginate([aBlock("a", 0, 10), aBlock("tall", 10, 250, { atomic: true })], 100);

    expect(filled.pages).toBe(3);
    expect(filled.pageOf["tall"]).toBe(1);
  });

  it("moves a heading down with what it heads rather than ending a page", () => {
    const blocks = [
      aBlock("a", 0, 70),
      aBlock("heading", 70, 10, { atomic: true, keepWithNext: true }),
      aBlock("b", 80, 40, { atomic: true }),
    ];

    expect(paginate(blocks, 100).pageOf).toEqual({ a: 1, heading: 2, b: 2 });
  });

  it("keeps a heading where it is when what follows fits under it", () => {
    const blocks = [
      aBlock("a", 0, 70),
      aBlock("heading", 70, 10, { atomic: true, keepWithNext: true }),
      aBlock("b", 80, 20, { atomic: true }),
    ];

    expect(paginate(blocks, 100).pageOf).toEqual({ a: 1, heading: 1, b: 1 });
  });

  it("puts what a block contains on the page the block landed on", () => {
    const blocks = [
      aBlock("a", 0, 90),
      aBlock("entry", 90, 30, { atomic: true, covers: ["entryp0", "entryp1"] }),
    ];

    expect(paginate(blocks, 100).pageOf).toMatchObject({ entryp0: 2, entryp1: 2 });
  });
});

function aTwoPointResume() {
  const store = emptyStore();
  const acme = anOrganisation("Acme");
  store.organisations.push(acme);

  const role = aRecord({
    kind: "experience",
    title: "Staff Engineer",
    organisationId: acme.id,
    startedOn: "2024-03",
    isCurrent: true,
  });
  store.records.push(role);

  const resume = aResume(store, "Backend, Acme");
  const section = aSection(store, resume.id, "experience", { sortKey: "a0" });
  const entry = anEntry(store, section, role.id, { sortKey: "a0" });
  const kept = aPoint(store, "Cut p95 latency to 120ms", { recordId: role.id });
  const spilled = aPoint(store, "Ran the on-call rotation", { recordId: role.id });
  anEntryPoint(store, entry, kept, { sortKey: "a0" });
  anEntryPoint(store, entry, spilled, { sortKey: "a1" });

  const document = compile(store, resume.id, { generatedAt: "2026-01-01T00:00:00.000Z" });
  if (document === undefined) throw new Error("the store holds the resume");
  const [only] = document.sections;
  if (only === undefined) throw new Error("the resume has one section");
  const [first, second] = only.entries[0]?.points ?? [];
  if (first === undefined || second === undefined) throw new Error("the entry has two points");

  return { document, section: only, first, second };
}

describe("what a resume costs against what it asked for", () => {
  it("names nothing when no limit was set", () => {
    const { document, second } = aTwoPointResume();
    const budget = lengthBudget(
      document,
      { pages: 4, pageOf: { [second.key]: 4 }, breaks: [] },
      null,
    );

    expect(budget).toMatchObject({ pages: 4, fits: true, limit: null, over: [] });
  });

  it("fits when the count is exactly the limit", () => {
    const { document } = aTwoPointResume();

    expect(lengthBudget(document, { pages: 2, pageOf: {}, breaks: [] }, 2).fits).toBe(true);
  });

  it("names the point that sits past the limit, and what it is under", () => {
    const { document, section, first, second } = aTwoPointResume();
    const budget = lengthBudget(
      document,
      {
        pages: 2,
        pageOf: { [section.key]: 1, [first.key]: 1, [second.key]: 2 },
        breaks: [500],
      },
      1,
    );

    expect(budget.fits).toBe(false);
    expect(budget.over).toEqual([
      { key: second.key, kind: "point", label: "Ran the on-call rotation", page: 2 },
    ]);
  });

  it("says nothing about a piece the layout never measured", () => {
    const { document } = aTwoPointResume();

    expect(lengthBudget(document, { pages: 3, pageOf: {}, breaks: [] }, 1).over).toEqual([]);
  });
});
