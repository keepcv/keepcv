import type { CareerRecord, Metric, Point, Store, Uuid } from "@keepcv/schema";
import {
  careerRecordSchema,
  metricSchema,
  organisationSchema,
  phrasingRevisionSchema,
  phrasingSchema,
  phrasingSetSchema,
  pointSchema,
  storeSchema,
} from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { newUuid } from "../identity/uuid.js";
import {
  live,
  organisationOf,
  overview,
  pointsOfRecord,
  recordCounts,
  textOfPoint,
  unplacedPoints,
} from "./selectors.js";

const EPOCH = "2026-01-01T00:00:00.000Z";

// Parsed through the schemas rather than cast: a fixture the wire format would
// reject is one these selectors are not actually being tested against.
function standard(overrides: { updatedAt?: string; archivedAt?: string | null } = {}) {
  return {
    id: newUuid(),
    createdAt: EPOCH,
    updatedAt: overrides.updatedAt ?? EPOCH,
    archivedAt: overrides.archivedAt ?? null,
  };
}

function emptyStore(): Store {
  return storeSchema.parse({
    profile: {
      ...standard(),
      fullName: null,
      pronouns: null,
      headline: null,
      location: null,
      summarySetId: null,
    },
    contactChannels: [],
    organisations: [],
    customSections: [],
    records: [],
    recordLinks: [],
    recordFields: [],
    phrasingSets: [],
    phrasings: [],
    phrasingRevisions: [],
    points: [],
    pointRecordLinks: [],
    metrics: [],
    evidence: [],
  });
}

// A kind's own columns are required keys that happen to be nullable, so a body
// missing them is not a record of that kind at all.
const columnsOfKind: Record<string, Record<string, unknown>> = {
  project: {},
  experience: { employmentType: null, mode: null },
  certification: { credentialId: null, expiresOn: null },
};

function aRecord(overrides: Record<string, unknown> = {}): CareerRecord {
  const { kind = "project" } = overrides as { kind?: string };
  return careerRecordSchema.parse({
    ...standard(),
    kind,
    ...columnsOfKind[kind],
    title: "a project",
    subtitle: null,
    organisationId: null,
    startedOn: null,
    endedOn: null,
    isCurrent: false,
    location: null,
    sortKey: "a0",
    summarySetId: null,
    ...overrides,
  });
}

// A point arrives with the words it holds, so the fixture writes all four rows
// of the chain rather than a point on its own.
function aPoint(store: Store, text: string, overrides: Record<string, unknown> = {}): Point {
  const phrasingId = newUuid();
  const revisionId = newUuid();
  const setId = newUuid();

  store.phrasingSets.push(
    phrasingSetSchema.parse({
      ...standard(),
      id: setId,
      purpose: "point",
      canonicalPhrasingId: phrasingId,
    }),
  );
  store.phrasings.push(
    phrasingSchema.parse({
      ...standard(),
      id: phrasingId,
      phrasingSetId: setId,
      variant: "standard",
      label: null,
      sortKey: "a0",
      currentRevisionId: revisionId,
    }),
  );
  store.phrasingRevisions.push(
    phrasingRevisionSchema.parse({
      id: revisionId,
      createdAt: EPOCH,
      phrasingId,
      body: [{ t: "text", v: text }],
      plainText: text,
      charCount: text.length,
      contentHash: "0".repeat(64),
    }),
  );

  const point = pointSchema.parse({
    ...standard(),
    recordId: null,
    phrasingSetId: setId,
    confidence: "unverified",
    occurredOn: null,
    sortKey: "a0",
    ...overrides,
  });
  store.points.push(point);
  return point;
}

function aMetric(pointId: Uuid, overrides: Record<string, unknown> = {}): Metric {
  return metricSchema.parse({
    ...standard(),
    pointId,
    label: "Latency",
    value: 120,
    unit: "ms",
    baseline: null,
    direction: null,
    period: null,
    sortKey: "a0",
    ...overrides,
  });
}

describe("live and archived", () => {
  it("splits rows without losing either side", () => {
    const rows = [aRecord(), aRecord({ archivedAt: EPOCH })];
    expect(live(rows)).toHaveLength(1);
    expect(live(rows)[0]?.archivedAt).toBeNull();
  });
});

describe("a record's points", () => {
  // A point prints under its primary record and relates to its secondary ones.
  // Counting one without the other gives a number the user cannot reconcile
  // with the points actually shown on the record.
  it("includes the ones linked to it as well as the ones printing under it", () => {
    const store = emptyStore();
    const record = aRecord();
    const other = aRecord();
    store.records.push(record, other);

    const printsHere = aPoint(store, "printed", { recordId: record.id });
    const alsoRelates = aPoint(store, "related", { recordId: other.id });
    store.pointRecordLinks.push({ pointId: alsoRelates.id, recordId: record.id });
    aPoint(store, "unrelated", { recordId: other.id });

    expect(
      pointsOfRecord(store, record.id)
        .map((p) => textOfPoint(store, p))
        .sort(),
    ).toEqual(["printed", "related"]);
    expect(printsHere.recordId).toBe(record.id);
  });

  it("finds nothing for a record nothing points at", () => {
    const store = emptyStore();
    expect(pointsOfRecord(store, newUuid())).toEqual([]);
  });
});

describe("a point's words", () => {
  it("resolves set, canonical phrasing and current revision", () => {
    const store = emptyStore();
    const point = aPoint(store, "Cut p95 latency to 120ms");
    expect(textOfPoint(store, point)).toBe("Cut p95 latency to 120ms");
  });

  // Reachable while the editor is open on a set whose canonical wording has no
  // revision yet, and a screen that threw here would be a blank page.
  it("answers with nothing rather than throwing when the chain is broken", () => {
    const store = emptyStore();
    const point = aPoint(store, "will be orphaned");
    store.phrasingRevisions = [];
    expect(textOfPoint(store, point)).toBe("");
  });
});

describe("record counts", () => {
  // A kind at zero is the invitation to add the first one. Dropping it from the
  // list would make it unclickable, which is the cold-start failure in miniature.
  it("names every kind, including the ones with nothing in them", () => {
    const store = emptyStore();
    store.records.push(
      aRecord({ kind: "experience" }),
      aRecord({ kind: "experience", archivedAt: EPOCH }),
    );

    const counts = recordCounts(store);
    expect(counts).toHaveLength(11);
    expect(counts.find((c) => c.kind === "experience")).toEqual({
      kind: "experience",
      live: 1,
      archived: 1,
    });
    expect(counts.find((c) => c.kind === "award")).toEqual({ kind: "award", live: 0, archived: 0 });
  });
});

describe("the overview", () => {
  it("puts the most recently edited record first and breaks ties by id", () => {
    const store = emptyStore();
    store.records.push(
      aRecord({ title: "older", updatedAt: "2026-01-01T00:00:00.000Z" }),
      aRecord({ title: "newer", updatedAt: "2026-06-01T00:00:00.000Z" }),
    );

    expect(overview(store, { asOf: EPOCH }).recentlyEdited.map((r) => r.title)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("leaves archived records out of the recent list and counts them separately", () => {
    const store = emptyStore();
    store.records.push(aRecord({ title: "gone", archivedAt: EPOCH }), aRecord({ title: "here" }));

    const result = overview(store, { asOf: EPOCH });
    expect(result.recentlyEdited.map((r) => r.title)).toEqual(["here"]);
    expect(result.totals).toEqual({ records: 1, points: 0, archived: 1 });
  });

  // "Still there" and "I have not filled this in yet" are different facts, which
  // is why an ongoing period is a flag and not a null end date.
  it("nudges about a finished record with no end date but not an ongoing one", () => {
    const store = emptyStore();
    store.records.push(
      aRecord({ title: "unfinished", startedOn: "2019", endedOn: null, isCurrent: false }),
      aRecord({ title: "ongoing", startedOn: "2019", endedOn: null, isCurrent: true }),
      aRecord({ title: "complete", startedOn: "2019", endedOn: "2021" }),
      aRecord({ title: "not started", startedOn: null, endedOn: null }),
    );

    expect(overview(store, { asOf: EPOCH }).unfinished.missingEndDate.map((r) => r.title)).toEqual([
      "unfinished",
    ]);
  });

  it("nudges about a point with no metric, and stops once it has one", () => {
    const store = emptyStore();
    const bare = aPoint(store, "no number");
    const measured = aPoint(store, "has a number");
    store.metrics.push(aMetric(measured.id));

    const result = overview(store, { asOf: EPOCH });
    expect(result.unfinished.pointsWithoutMetrics.map((p) => p.id)).toEqual([bare.id]);
  });

  // An archived metric is not a metric the point still claims, so the nudge
  // comes back rather than staying satisfied by a row nobody can see.
  it("counts an archived metric as no metric", () => {
    const store = emptyStore();
    const point = aPoint(store, "had a number once");
    store.metrics.push(aMetric(point.id, { archivedAt: EPOCH }));

    expect(overview(store, { asOf: EPOCH }).unfinished.pointsWithoutMetrics).toHaveLength(1);
  });

  it("warns about a certification expiring inside the horizon and not one past it", () => {
    const store = emptyStore();
    store.records.push(
      aRecord({
        kind: "certification",
        title: "soon",
        expiresOn: "2026-02-01",
      } as Partial<CareerRecord>),
      aRecord({
        kind: "certification",
        title: "later",
        expiresOn: "2027-01-01",
      } as Partial<CareerRecord>),
      aRecord({
        kind: "certification",
        title: "no expiry",
        expiresOn: null,
      } as Partial<CareerRecord>),
    );

    expect(
      overview(store, { asOf: "2026-01-01T00:00:00.000Z" }).unfinished.expiringCertifications.map(
        (r) => r.title,
      ),
    ).toEqual(["soon"]);
  });

  // Already expired is more urgent than expiring, not less, so it stays on the
  // list rather than dropping off the moment the date passes.
  it("keeps a certification that has already expired on the list", () => {
    const store = emptyStore();
    store.records.push(
      aRecord({
        kind: "certification",
        title: "lapsed",
        expiresOn: "2020-01-01",
      } as Partial<CareerRecord>),
    );

    expect(overview(store, { asOf: EPOCH }).unfinished.expiringCertifications).toHaveLength(1);
  });

  it("lists the points nobody has placed", () => {
    const store = emptyStore();
    const record = aRecord();
    store.records.push(record);
    const loose = aPoint(store, "somewhere, eventually");
    aPoint(store, "placed", { recordId: record.id });

    expect(unplacedPoints(store).map((p) => p.id)).toEqual([loose.id]);
    expect(overview(store, { asOf: EPOCH }).unfinished.unplacedPoints).toHaveLength(1);
  });

  it("says nothing is unfinished in a store with nothing in it", () => {
    const result = overview(emptyStore(), { asOf: EPOCH });
    expect(result.totals).toEqual({ records: 0, points: 0, archived: 0 });
    // Every list on it, so a nudge added later without an empty-store case
    // fails here rather than greeting a new user with a warning.
    expect(Object.values(result.unfinished).map((list: unknown[]) => list.length)).toEqual([
      0, 0, 0, 0,
    ]);
  });
});

describe("a record's organisation", () => {
  it("resolves the one it names and nothing when it names none", () => {
    const store = emptyStore();
    const org = organisationSchema.parse({
      ...standard(),
      name: "Analytical Engines",
      kind: "company",
      website: null,
      industry: null,
      location: null,
    });
    store.organisations.push(org);

    expect(organisationOf(store, aRecord({ organisationId: org.id }))?.name).toBe(
      "Analytical Engines",
    );
    expect(organisationOf(store, aRecord())).toBeUndefined();
  });
});
