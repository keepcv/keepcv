import { describe, expect, it } from "vitest";
import { addPoint, addRecord, emptyStore } from "../../../store.harness.js";
import {
  BLANK_METRIC,
  blankPointValues,
  buildMetric,
  buildPointSubmission,
  pointValuesOf,
} from "./point-form.js";

describe("the point form", () => {
  // A point arrives with the words it holds, so a create that sent only the row
  // would leave a point that says nothing.
  it("sends the whole chain a point needs", () => {
    const store = emptyStore();
    const built = buildPointSubmission(store, {
      ...blankPointValues(),
      text: "  Cut p95 latency from 800ms to 120ms  ",
    });

    if (!("point" in built)) throw new Error("should build");
    expect(built.point.phrasing.body).toEqual([
      { t: "text", v: "Cut p95 latency from 800ms to 120ms" },
    ]);
    expect(built.point.phrasing.variant).toBe("standard");
    expect(built.point.phrasingSetId).not.toBe(built.point.id);
  });

  it("leaves a point unplaced rather than refusing it", () => {
    const built = buildPointSubmission(emptyStore(), { ...blankPointValues(), text: "Somewhere" });

    if (!("point" in built)) throw new Error("should build");
    expect(built.point.recordId).toBeNull();
    expect(built.point.occurredOn).toBeNull();
  });

  it("reads a stored point back into the form it was written in", () => {
    const store = emptyStore();
    const record = addRecord(store, { kind: "experience", title: "Engine lead" });
    const point = addPoint(store, "Rewrote the scheduler", {
      recordId: record.id,
      confidence: "verified",
    });

    expect(pointValuesOf(store, point)).toEqual({
      text: "Rewrote the scheduler",
      recordId: record.id,
      confidence: "verified",
      occurredOn: "",
    });
  });

  it("names the field a metric was refused on", () => {
    const store = emptyStore();
    const point = addPoint(store, "Cut p95 latency");

    expect(buildMetric(store, point.id, { ...BLANK_METRIC, label: "p95", value: "fast" })).toEqual({
      errors: { value: "expected a number" },
    });
    expect(buildMetric(store, point.id, { ...BLANK_METRIC, value: "120" })).toHaveProperty(
      "errors.label",
    );
  });

  // An unmeasured baseline is "no baseline", not a refusal: most points have
  // one number, not two.
  it("takes a metric with no baseline and no unit", () => {
    const store = emptyStore();
    const point = addPoint(store, "Cut p95 latency");
    const built = buildMetric(store, point.id, { ...BLANK_METRIC, label: "Services", value: "40" });

    if (!("metric" in built)) throw new Error("should build");
    expect(built.metric.baseline).toBeNull();
    expect(built.metric.unit).toBeNull();
  });
});
