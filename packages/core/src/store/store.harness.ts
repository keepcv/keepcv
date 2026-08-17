import type { CareerRecord, Metric, Point, Store, Tag, Uuid } from "@keepcv/schema";
import {
  careerRecordSchema,
  metricSchema,
  organisationSchema,
  phrasingRevisionSchema,
  phrasingSchema,
  phrasingSetSchema,
  pointSchema,
  storeSchema,
  tagSchema,
} from "@keepcv/schema";
import { newUuid } from "../identity/uuid.js";

// Parsed through the schemas rather than cast: a fixture the wire format would
// reject is one the selectors are not actually being tested against.

export const EPOCH = "2026-01-01T00:00:00.000Z";

export function standard(overrides: { updatedAt?: string; archivedAt?: string | null } = {}) {
  return {
    id: newUuid(),
    createdAt: EPOCH,
    updatedAt: overrides.updatedAt ?? EPOCH,
    archivedAt: overrides.archivedAt ?? null,
  };
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

export function aRecord(overrides: Record<string, unknown> = {}): CareerRecord {
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

// A phrasing set with one wording in it, which is the shape a point and a
// summary both reach their words through.
export function aPhrasingSet(store: Store, purpose: string, text: string): Uuid {
  const phrasingId = newUuid();
  const revisionId = newUuid();
  const setId = newUuid();

  store.phrasingSets.push(
    phrasingSetSchema.parse({
      ...standard(),
      id: setId,
      purpose,
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
  return setId;
}

// A point arrives with the words it holds, so this writes all four rows of the
// chain rather than a point on its own.
export function aPoint(store: Store, text: string, overrides: Record<string, unknown> = {}): Point {
  const point = pointSchema.parse({
    ...standard(),
    recordId: null,
    phrasingSetId: aPhrasingSet(store, "point", text),
    confidence: "unverified",
    occurredOn: null,
    sortKey: "a0",
    ...overrides,
  });
  store.points.push(point);
  return point;
}

export function aMetric(pointId: Uuid, overrides: Record<string, unknown> = {}): Metric {
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

export function anOrganisation(name: string, overrides: Record<string, unknown> = {}) {
  return organisationSchema.parse({
    ...standard(),
    name,
    kind: "company",
    website: null,
    industry: null,
    location: null,
    ...overrides,
  });
}

export function aTag(store: Store, label: string, overrides: Record<string, unknown> = {}): Tag {
  const tag = tagSchema.parse({
    ...standard(),
    slug: label.toLowerCase(),
    label,
    category: null,
    ...overrides,
  });
  store.tags.push(tag);
  return tag;
}
