import { describe, expect, it } from "vitest";
import { EVIDENCE_KINDS, evidenceSchema } from "./evidence.js";
import { METRIC_DIRECTIONS, metricPatchSchema, metricSchema } from "./metric.js";
import { POINT_CONFIDENCES, pointInputSchema, pointPatchSchema, pointSchema } from "./point.js";

const id = "019891a4-6ac5-7000-8000-000000000001";
const other = "019891a4-6ac5-7000-8000-000000000002";
const at = "2026-08-08T12:00:00.000Z";
const timestamps = { createdAt: at, updatedAt: at, archivedAt: null };

const point = {
  ...timestamps,
  id,
  recordId: other,
  phrasingSetId: other,
  confidence: "unverified",
  occurredOn: null,
  sortKey: "a0",
};

const metric = {
  ...timestamps,
  id,
  pointId: other,
  label: "p95 latency",
  value: 120,
  unit: "ms",
  baseline: 800,
  direction: "decrease",
  period: null,
  sortKey: "a0",
};

const evidence = {
  ...timestamps,
  id,
  pointId: other,
  kind: "url",
  value: "https://example.com/dashboard",
  note: null,
};

describe("pointSchema", () => {
  it("accepts every declared confidence and rejects an undeclared one", () => {
    for (const confidence of POINT_CONFIDENCES) {
      expect(pointSchema.safeParse({ ...point, confidence }).success).toBe(true);
    }
    expect(pointSchema.safeParse({ ...point, confidence: "disputed" }).success).toBe(false);
  });

  // Captured before it is decided where it belongs, which is a state the
  // product exists to allow.
  it("accepts a point with no record, and none with no phrasing set", () => {
    expect(pointSchema.safeParse({ ...point, recordId: null }).success).toBe(true);
    expect(pointSchema.safeParse({ ...point, phrasingSetId: null }).success).toBe(false);
  });

  it("carries no text, because text lives in the phrasing set", () => {
    expect(Object.keys(pointSchema.shape)).not.toContain("body");
  });
});

describe("pointInputSchema", () => {
  it("refuses a point created without the words it is for", () => {
    const { createdAt, updatedAt, archivedAt, ...input } = point;
    expect(pointInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("pointPatchSchema", () => {
  // Both are real edits: placing a captured point, and taking one back out of a
  // record without losing it.
  it("can set and clear the record a point prints under", () => {
    expect(pointPatchSchema.parse({ recordId: other })).toEqual({ recordId: other });
    expect(pointPatchSchema.parse({ recordId: null })).toEqual({ recordId: null });
  });

  it("cannot move a point to a different phrasing set", () => {
    expect(pointPatchSchema.parse({ phrasingSetId: id, sortKey: "a1" })).toEqual({ sortKey: "a1" });
  });
});

describe("metricSchema", () => {
  it("accepts every declared direction, and none at all", () => {
    for (const direction of METRIC_DIRECTIONS) {
      expect(metricSchema.safeParse({ ...metric, direction }).success).toBe(true);
    }
    expect(metricSchema.safeParse({ ...metric, direction: null }).success).toBe(true);
    expect(metricSchema.safeParse({ ...metric, direction: "sideways" }).success).toBe(false);
  });

  // JSON has no way to write either one back, and the store is exported as
  // JSON.
  it("rejects a value JSON cannot carry", () => {
    expect(metricSchema.safeParse({ ...metric, value: Number.POSITIVE_INFINITY }).success).toBe(
      false,
    );
    expect(metricSchema.safeParse({ ...metric, value: Number.NaN }).success).toBe(false);
  });

  it("cannot be re-parented by a patch", () => {
    expect(metricPatchSchema.parse({ pointId: id, value: 90 })).toEqual({ value: 90 });
  });
});

describe("evidenceSchema", () => {
  it("accepts every declared kind and rejects an undeclared one", () => {
    for (const kind of EVIDENCE_KINDS) {
      expect(evidenceSchema.safeParse({ ...evidence, kind }).success).toBe(true);
    }
    expect(evidenceSchema.safeParse({ ...evidence, kind: "screenshot" }).success).toBe(false);
  });

  it("has no sort key, because evidence is a set and not a list", () => {
    expect(Object.keys(evidenceSchema.shape)).not.toContain("sortKey");
  });
});
