import { newUuid } from "@keepcv/core";
import {
  type CareerRecord,
  careerRecordSchema,
  type Evidence,
  evidenceSchema,
  type Metric,
  metricSchema,
  type Point,
  PROBLEM_TYPES,
  pointRecordLinkSchema,
  pointSchema,
  type Uuid,
} from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { problemOf, withApi } from "../api.harness.js";

const { send } = withApi();

async function created<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  expect(response.status).toBe(201);
  return schema.parse(await response.json());
}

async function items<T>(response: Response, schema: z.ZodType<T>): Promise<T[]> {
  expect(response.status).toBe(200);
  return z.object({ items: z.array(schema) }).parse(await response.json()).items;
}

async function addRecord(sortKey: string): Promise<CareerRecord> {
  return await created(
    await send("POST", "/v1/records", {
      id: newUuid(),
      kind: "project",
      title: "a project",
      subtitle: null,
      organisationId: null,
      startedOn: null,
      endedOn: null,
      isCurrent: false,
      location: null,
      sortKey,
      summarySetId: null,
    }),
    careerRecordSchema,
  );
}

// A point arrives with the words it exists to hold: the phrasing set, phrasing
// and first revision are written with it, in one transaction.
async function addPoint(
  recordId: Uuid | null,
  sortKey: string,
  text: string,
  overrides: Record<string, unknown> = {},
): Promise<Point> {
  return await created(
    await send("POST", "/v1/points", {
      id: newUuid(),
      recordId,
      phrasingSetId: newUuid(),
      confidence: "unverified",
      occurredOn: null,
      sortKey,
      phrasing: {
        id: newUuid(),
        variant: "standard",
        label: null,
        sortKey: "a0",
        body: [{ t: "text", v: text }],
      },
      ...overrides,
    }),
    pointSchema,
  );
}

async function addMetric(pointId: Uuid, sortKey: string, label: string): Promise<Metric> {
  return await created(
    await send("POST", "/v1/metrics", {
      id: newUuid(),
      pointId,
      label,
      value: 120,
      unit: "ms",
      baseline: 800,
      direction: "decrease",
      period: null,
      sortKey,
    }),
    metricSchema,
  );
}

async function addEvidence(pointId: Uuid, value: string): Promise<Evidence> {
  return await created(
    await send("POST", "/v1/evidence", {
      id: newUuid(),
      pointId,
      kind: "url",
      value,
      note: null,
    }),
    evidenceSchema,
  );
}

describe("points", () => {
  it("is created with the words it holds, reachable through its phrasing set", async () => {
    const point = await addPoint(null, "a0", "Cut p95 latency from 800ms to 120ms");

    const phrasings = await items(
      await send("GET", `/v1/phrasings?phrasingSetId=${point.phrasingSetId}`),
      z.object({ id: z.string(), currentRevisionId: z.string().nullable() }),
    );
    expect(phrasings).toHaveLength(1);

    const revisions = await items(
      await send("GET", `/v1/phrasings/${phrasings[0]?.id}/revisions`),
      z.object({ plainText: z.string() }),
    );
    expect(revisions.map((r) => r.plainText)).toEqual(["Cut p95 latency from 800ms to 120ms"]);
  });

  it("narrows a list to one record, and to one confidence", async () => {
    const record = await addRecord("a0");
    await addPoint(record.id, "a0", "Placed", { confidence: "verified" });
    await addPoint(null, "a0", "Unplaced");

    expect(
      await items(await send("GET", `/v1/points?recordId=${record.id}`), pointSchema),
    ).toHaveLength(1);
    const verified = await items(await send("GET", "/v1/points?confidence=verified"), pointSchema);
    expect(verified.map((point) => point.confidence)).toEqual(["verified"]);
    expect(await items(await send("GET", "/v1/points"), pointSchema)).toHaveLength(2);
  });

  it("refuses a confidence that does not exist", async () => {
    const problem = await problemOf(await send("GET", "/v1/points?confidence=hopeful"));
    expect(problem.status).toBe(422);
    expect(problem.type).toBe(PROBLEM_TYPES.validationFailed);
  });

  // A point captured before it is decided where it belongs is the normal case,
  // so placing one later must not lose anything.
  it("takes a captured point and places it under a record", async () => {
    const record = await addRecord("a0");
    const point = await addPoint(null, "a0", "Words");

    const placed = await send("PATCH", `/v1/points/${point.id}`, {
      expectedUpdatedAt: point.updatedAt,
      patch: { recordId: record.id },
    });
    expect(pointSchema.parse(await placed.json()).recordId).toBe(record.id);
  });
});

describe("a point's secondary records", () => {
  it("relates a point to a record it does not print under", async () => {
    const printsUnder = await addRecord("a0");
    const alsoRelates = await addRecord("a1");
    const point = await addPoint(printsUnder.id, "a0", "Words");

    const linked = await send("PUT", `/v1/points/${point.id}/records/${alsoRelates.id}`);
    expect(linked.status).toBe(200);
    expect(pointRecordLinkSchema.parse(await linked.json())).toEqual({
      pointId: point.id,
      recordId: alsoRelates.id,
    });

    const listed = await items(
      await send("GET", `/v1/points/${point.id}/records`),
      pointRecordLinkSchema,
    );
    expect(listed.map((link) => link.recordId)).toEqual([alsoRelates.id]);
  });

  // The pair is the whole row, so a repeat has nothing to change.
  it("links the same pair twice without complaint", async () => {
    const record = await addRecord("a0");
    const point = await addPoint(null, "a0", "Words");

    expect((await send("PUT", `/v1/points/${point.id}/records/${record.id}`)).status).toBe(200);
    expect((await send("PUT", `/v1/points/${point.id}/records/${record.id}`)).status).toBe(200);
    expect(
      await items(await send("GET", `/v1/points/${point.id}/records`), pointRecordLinkSchema),
    ).toHaveLength(1);
  });

  it("refuses to link the record the point already prints under", async () => {
    const record = await addRecord("a0");
    const point = await addPoint(record.id, "a0", "Words");

    const problem = await problemOf(
      await send("PUT", `/v1/points/${point.id}/records/${record.id}`),
    );
    expect(problem.status).toBe(409);
    expect(problem.type).toBe(PROBLEM_TYPES.constraintViolated);
  });

  // Unlinking a pair that was never linked has already achieved what the caller
  // asked for, so it is the same answer.
  it("unlinks, and says the same thing when there was no link", async () => {
    const record = await addRecord("a0");
    const point = await addPoint(null, "a0", "Words");
    await send("PUT", `/v1/points/${point.id}/records/${record.id}`);

    expect((await send("DELETE", `/v1/points/${point.id}/records/${record.id}`)).status).toBe(204);
    expect((await send("DELETE", `/v1/points/${point.id}/records/${record.id}`)).status).toBe(204);
    expect(
      await items(await send("GET", `/v1/points/${point.id}/records`), pointRecordLinkSchema),
    ).toEqual([]);
  });

  // An unknown point has no secondary records, but neither does an empty list
  // say so - it would read as "this point relates to nothing".
  it("answers an unknown point rather than an empty list", async () => {
    const problem = await problemOf(await send("GET", `/v1/points/${newUuid()}/records`));
    expect(problem.status).toBe(404);
  });

  it("answers an unknown point rather than pretending the link happened", async () => {
    const record = await addRecord("a0");
    const problem = await problemOf(
      await send("PUT", `/v1/points/${newUuid()}/records/${record.id}`),
    );
    expect(problem.status).toBe(404);
  });
});

describe("metrics and evidence", () => {
  it("hang off a point and are narrowed to it", async () => {
    const point = await addPoint(null, "a0", "Words");
    const elsewhere = await addPoint(null, "a1", "Other words");
    await addMetric(point.id, "a0", "p95 latency");
    await addMetric(elsewhere.id, "a0", "throughput");
    await addEvidence(point.id, "https://example.com/dashboard");

    expect(
      await items(await send("GET", `/v1/metrics?pointId=${point.id}`), metricSchema),
    ).toHaveLength(1);
    expect(await items(await send("GET", "/v1/metrics"), metricSchema)).toHaveLength(2);
    expect(
      await items(await send("GET", `/v1/evidence?pointId=${point.id}`), evidenceSchema),
    ).toHaveLength(1);
  });

  it("keep a fractional value as it was given", async () => {
    const point = await addPoint(null, "a0", "Words");
    const metric = await created(
      await send("POST", "/v1/metrics", {
        id: newUuid(),
        pointId: point.id,
        label: "conversion",
        value: 0.125,
        unit: "%",
        baseline: null,
        direction: "increase",
        period: null,
        sortKey: "a0",
      }),
      metricSchema,
    );
    expect(metric.value).toBe(0.125);
  });

  it("stay readable by id once archived", async () => {
    const point = await addPoint(null, "a0", "Words");
    const item = await addEvidence(point.id, "https://example.com/dashboard");

    await send("DELETE", `/v1/evidence/${item.id}`, { expectedUpdatedAt: item.updatedAt });

    const read = await send("GET", `/v1/evidence/${item.id}`);
    expect(read.status).toBe(200);
    expect(evidenceSchema.parse(await read.json()).archivedAt).not.toBeNull();
    expect(
      await items(await send("GET", `/v1/evidence?pointId=${point.id}`), evidenceSchema),
    ).toEqual([]);
  });

  it("answer a stale metric patch with the state the server holds", async () => {
    const point = await addPoint(null, "a0", "Words");
    const metric = await addMetric(point.id, "a0", "p95 latency");
    await send("PATCH", `/v1/metrics/${metric.id}`, {
      expectedUpdatedAt: metric.updatedAt,
      patch: { unit: "seconds" },
    });

    const stale = await send("PATCH", `/v1/metrics/${metric.id}`, {
      expectedUpdatedAt: metric.updatedAt,
      patch: { unit: "minutes" },
    });
    expect(stale.status).toBe(409);
    expect(metricSchema.parse((await problemOf(stale)).current).unit).toBe("seconds");
  });

  it("refuse to hang off a point nobody owns", async () => {
    const problem = await problemOf(
      await send("POST", "/v1/evidence", {
        id: newUuid(),
        pointId: newUuid(),
        kind: "url",
        value: "https://example.com",
        note: null,
      }),
    );
    expect(problem.status).toBe(422);
    expect(problem.constraint).toBe("evidence_point_fk");
  });
});
