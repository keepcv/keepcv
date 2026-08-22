import { describe, expect, it } from "vitest";
import { addMetric, addPoint, addRecord, addTag, emptyStore } from "../../../store.harness.js";
import { pointRows } from "./point-rows.js";

describe("filtering the point list", () => {
  it("narrows to one tag, on top of every other narrowing", () => {
    const store = emptyStore();
    const record = addRecord(store, { title: "Ledger rewrite" });
    const filed = addPoint(store, "filed and tagged", { recordId: record.id });
    const loose = addPoint(store, "unplaced and tagged");
    addPoint(store, "untagged");
    const tag = addTag(store, "Kubernetes");
    addMetric(store, filed.id);
    store.pointTags.push(
      { tagId: tag.id, pointId: filed.id },
      { tagId: tag.id, pointId: loose.id },
    );

    expect(pointRows(store, { filter: "all", tagId: tag.id }).map((row) => row.text)).toEqual([
      "filed and tagged",
      "unplaced and tagged",
    ]);
    expect(pointRows(store, { filter: "unplaced", tagId: tag.id }).map((row) => row.text)).toEqual([
      "unplaced and tagged",
    ]);
  });
});
