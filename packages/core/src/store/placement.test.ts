import { customSectionSchema, sortKeySchema, timestampSchema, type Uuid } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import {
  entryFor,
  entryPointFor,
  keyForPosition,
  placeablePoints,
  placeableRecords,
  placeableSections,
  sectionFor,
} from "./placement.js";
import {
  anEntry,
  anEntryPoint,
  aPoint,
  aRecord,
  aResume,
  aSection,
  emptyStore,
  standard,
} from "./store.harness.js";

function key(value: string) {
  return sortKeySchema.parse(value);
}

const REMOVED = timestampSchema.parse("2026-02-01T00:00:00.000Z");

// Sort keys order as strings, and the numeric matchers will not compare them.
function sortedWith(key: string | undefined, ...others: string[]): (string | undefined)[] {
  return [...others, key].sort();
}

function placed(rows: [string, string, boolean][]) {
  return rows.map(([id, sortKey, isLive]) => ({
    id: id as Uuid,
    sortKey: key(sortKey),
    archivedAt: isLive ? null : REMOVED,
  }));
}

function aStoreWithAJob() {
  const store = emptyStore();
  const resume = aResume(store, "Backend");
  const record = aRecord({ kind: "experience", title: "Engine lead" });
  store.records.push(record);
  const section = aSection(store, resume.id, "experience");
  const entry = anEntry(store, section, record.id);
  return { store, resume, section, entry };
}

describe("placeableSections", () => {
  it("offers every kind the resume does not hold", () => {
    const store = emptyStore();
    const resume = aResume(store, "Backend");
    aSection(store, resume.id, "experience");

    const kinds = placeableSections(store, resume.id).map((row) => row.kind);
    expect(kinds).not.toContain("experience");
    expect(kinds).toContain("education");
    expect(placeableSections(store, resume.id)[0]?.heading).toBe("Education");
  });

  // `resume_section_kind_unique` has no predicate on `archived_at`, so a second
  // insert is refused by the index rather than accepted.
  it("does not offer a kind whose section was removed, which restores instead", () => {
    const store = emptyStore();
    const resume = aResume(store, "Backend");
    const section = aSection(store, resume.id, "education", { archivedAt: REMOVED });

    expect(placeableSections(store, resume.id).map((row) => row.kind)).toContain("education");
    expect(sectionFor(store, resume.id, section)?.id).toBe(section.id);
  });

  it("offers custom once per custom section the store defines", () => {
    const store = emptyStore();
    const resume = aResume(store, "Backend");
    store.customSections.push(
      customSectionSchema.parse({ ...standard(), heading: "Patents", sortKey: "a0" }),
    );

    const custom = placeableSections(store, resume.id).filter((row) => row.kind === "custom");
    expect(custom).toHaveLength(1);
    expect(custom[0]?.heading).toBe("Patents");
  });
});

describe("placeableRecords", () => {
  it("offers records of the section's kind that it does not hold", () => {
    const { store, section } = aStoreWithAJob();
    store.records.push(
      aRecord({ kind: "experience", title: "Platform engineer" }),
      aRecord({ kind: "education", title: "BSc" }),
    );

    expect(placeableRecords(store, section.id).map((row) => row.title)).toEqual([
      "Platform engineer",
    ]);
  });

  it("offers a record whose entry was removed, and says which entry to put back", () => {
    const { store, section, entry } = aStoreWithAJob();
    entry.archivedAt = REMOVED;

    expect(placeableRecords(store, section.id).map((row) => row.title)).toEqual(["Engine lead"]);
    expect(entryFor(store, section.id, entry.recordId)?.id).toBe(entry.id);
  });
});

describe("placeablePoints", () => {
  it("offers the record's points that this resume does not print", () => {
    const { store, resume, entry } = aStoreWithAJob();
    const printed = aPoint(store, "Cut p95 latency", { recordId: entry.recordId });
    const spare = aPoint(store, "Ran the migration", { recordId: entry.recordId });
    anEntryPoint(store, entry, printed);

    expect(placeablePoints(store, resume.id, entry.id).map((row) => row.id)).toEqual([spare.id]);
  });

  // I13: no patch moves an entry point between entries, so offering it here
  // would restore it under the entry it was removed from.
  it("does not offer a point put away under another entry of the same resume", () => {
    const { store, resume, section, entry } = aStoreWithAJob();
    const second = aRecord({ kind: "experience", title: "Platform engineer", sortKey: key("a1") });
    store.records.push(second);
    const secondEntry = anEntry(store, section, second.id, { sortKey: key("a1") });

    const shared = aPoint(store, "Shared point", { recordId: entry.recordId });
    store.pointRecordLinks.push({ pointId: shared.id, recordId: second.id });
    anEntryPoint(store, entry, shared, { archivedAt: REMOVED });

    expect(placeablePoints(store, resume.id, secondEntry.id)).toEqual([]);
    expect(placeablePoints(store, resume.id, entry.id).map((row) => row.id)).toEqual([shared.id]);
    expect(entryPointFor(store, resume.id, shared.id)?.pointId).toBe(shared.id);
  });
});

describe("keyForPosition", () => {
  it("orders a row between the two it lands between", () => {
    const rows = placed([
      ["a", "a0", true],
      ["b", "a1", true],
      ["c", "a2", true],
    ]);
    const moved = keyForPosition(rows, "c" as Uuid, 1);
    expect(sortedWith(moved, "a0", "a1")).toEqual(["a0", moved, "a1"]);
  });

  it("appends when the position is past the last row", () => {
    const appended = keyForPosition(placed([["a", "a0", true]]), null, 9);
    expect(sortedWith(appended, "a0")).toEqual(["a0", appended]);
  });

  it("writes nothing when the row is already there", () => {
    const rows = placed([
      ["a", "a0", true],
      ["b", "a1", true],
    ]);
    expect(keyForPosition(rows, "b" as Uuid, 1)).toBeUndefined();
    expect(keyForPosition(rows, "b" as Uuid, rows.length)).toBeUndefined();
  });

  // The sort-key indexes have no predicate on `archived_at`, so the midpoint of
  // two live neighbours is exactly the key a row removed from that gap still holds.
  it("clears a removed row still holding a key in the gap", () => {
    const rows = placed([
      ["a", "a0", true],
      ["gone", "a0V", false],
      ["b", "a1", true],
      ["c", "a2", true],
    ]);
    const moved = keyForPosition(rows, "c" as Uuid, 1);
    expect(rows.map((row) => row.sortKey)).not.toContain(moved);
    expect(sortedWith(moved, "a0V", "a1")).toEqual(["a0V", moved, "a1"]);
  });

  it("clears a removed row past the end when appending", () => {
    const rows = placed([
      ["a", "a0", true],
      ["gone", "a1", false],
    ]);
    const appended = keyForPosition(rows, null, 1);
    expect(rows.map((row) => row.sortKey)).not.toContain(appended);
    expect(sortedWith(appended, "a1")).toEqual(["a1", appended]);
  });
});
