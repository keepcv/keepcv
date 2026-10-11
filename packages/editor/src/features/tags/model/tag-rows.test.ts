import { describe, expect, it } from "vitest";
import { addPoint, addRecord, addTag, emptyStore } from "../../../store.harness.js";
import { labelError, tagRows } from "./tag-rows.js";

function aStore() {
  const store = emptyStore();
  const record = addRecord(store, { title: "Ledger rewrite" });
  const point = addPoint(store, "Ran it in anger");

  const kubernetes = addTag(store, "Kubernetes");
  const terraform = addTag(store, "Terraform");
  const retired = addTag(store, "Retired", { archivedAt: "2026-01-02T00:00:00.000Z" });

  store.recordTags.push({ tagId: kubernetes.id, recordId: record.id });
  store.pointTags.push({ tagId: kubernetes.id, pointId: point.id });

  return { store, kubernetes, terraform, retired };
}

describe("the tag list", () => {
  it("lists live tags by name with what each one carries", () => {
    const { store } = aStore();

    expect(tagRows(store, "all")).toEqual([
      expect.objectContaining({ records: 1, points: 1, isArchived: false }),
      expect.objectContaining({ records: 0, points: 0, isArchived: false }),
    ]);
    expect(tagRows(store, "all").map((row) => row.tag.label)).toEqual(["Kubernetes", "Terraform"]);
  });

  // A tag nothing carries is the one worth merging away, and finding it in a
  // vocabulary of eighty by eye is not a thing anyone does.
  it("narrows to the tags nothing carries", () => {
    const { store } = aStore();

    expect(tagRows(store, "unused").map((row) => row.tag.label)).toEqual(["Terraform"]);
  });

  it("keeps an archived tag off every list but its own", () => {
    const { store } = aStore();

    expect(tagRows(store, "all").map((row) => row.tag.label)).not.toContain("Retired");
    expect(tagRows(store, "unused").map((row) => row.tag.label)).not.toContain("Retired");
    expect(tagRows(store, "archived").map((row) => row.tag.label)).toEqual(["Retired"]);
  });
});

describe("naming a tag", () => {
  it("refuses an empty name", () => {
    expect(labelError(emptyStore(), "   ")).toBe("A tag needs a name.");
  });

  // The store refuses a second label that slugs alike, so the form has to say
  // which tag it would collide with before the write goes out.
  it("names the tag a new label would collide with", () => {
    const { store } = aStore();

    expect(labelError(store, "kubernetes")).toBe("Kubernetes already covers that.");
    expect(labelError(store, "Rust")).toBeUndefined();
  });

  it("lets a tag keep its own name while it is being edited", () => {
    const { store, kubernetes } = aStore();

    expect(labelError(store, "Kubernetes", kubernetes)).toBeUndefined();
    expect(labelError(store, "Terraform", kubernetes)).toBe("Terraform already covers that.");
  });
});
