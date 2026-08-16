import { newUuid } from "@keepcv/core";
import {
  type CareerRecord,
  careerRecordSchema,
  metricSchema,
  organisationSchema,
  type Point,
  phrasingRevisionSchema,
  phrasingSchema,
  phrasingSetSchema,
  pointSchema,
  type Store,
  storeSchema,
  type Uuid,
} from "@keepcv/schema";

const EPOCH = "2026-01-01T00:00:00.000Z";

// Parsed through the schemas rather than cast, so a fixture the wire format
// would reject cannot pass a screen test the real payload would fail.
function standard(overrides: Record<string, unknown> = {}) {
  return { id: newUuid(), createdAt: EPOCH, updatedAt: EPOCH, archivedAt: null, ...overrides };
}

export function emptyStore(): Store {
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
    tags: [],
    recordTags: [],
    pointTags: [],
    drafts: [],
  });
}

// A kind's own columns are required keys that happen to be nullable, so a body
// missing them is not a record of that kind at all.
const columnsOfKind: Record<string, Record<string, unknown>> = {
  project: {},
  experience: { employmentType: null, mode: null },
  certification: { credentialId: null, expiresOn: null },
};

export function addRecord(store: Store, overrides: Record<string, unknown> = {}): CareerRecord {
  const { kind = "project" } = overrides as { kind?: string };
  const entry = careerRecordSchema.parse({
    ...standard(),
    kind,
    ...columnsOfKind[kind],
    title: "a record",
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
  store.records.push(entry);
  return entry;
}

export function addOrganisation(store: Store, name: string): Uuid {
  const row = organisationSchema.parse({
    ...standard(),
    name,
    kind: "company",
    website: null,
    industry: null,
    location: null,
  });
  store.organisations.push(row);
  return row.id;
}

// A point arrives with the words it holds, so the fixture writes all four rows
// of the chain rather than a point on its own.
export function addPoint(
  store: Store,
  text: string,
  overrides: Record<string, unknown> = {},
): Point {
  const setId = newUuid();
  const phrasingId = newUuid();
  const revisionId = newUuid();

  store.phrasingSets.push(
    phrasingSetSchema.parse({
      ...standard({ id: setId }),
      purpose: "point",
      canonicalPhrasingId: phrasingId,
    }),
  );
  store.phrasings.push(
    phrasingSchema.parse({
      ...standard({ id: phrasingId }),
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

export function addMetric(store: Store, pointId: Uuid): void {
  store.metrics.push(
    metricSchema.parse({
      ...standard(),
      pointId,
      label: "Latency",
      value: 120,
      unit: "ms",
      baseline: null,
      direction: null,
      period: null,
      sortKey: "a0",
    }),
  );
}

// One store with something of everything on the two screens this app has.
export function aFilledStore(): Store {
  const store = emptyStore();
  const engines = addOrganisation(store, "Analytical Engines");

  const role = addRecord(store, {
    kind: "experience",
    title: "Engine lead",
    organisationId: engines,
    startedOn: "2019-04",
    endedOn: null,
    isCurrent: true,
  });
  addRecord(store, { kind: "project", title: "Difference Engine", startedOn: "2021" });
  addRecord(store, { kind: "project", title: "Shelved idea", archivedAt: EPOCH });

  const measured = addPoint(store, "Cut p95 latency from 800ms to 120ms", { recordId: role.id });
  addMetric(store, measured.id);
  addPoint(store, "Somewhere, eventually");

  return store;
}
