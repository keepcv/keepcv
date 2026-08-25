import type {
  CareerRecord,
  Metric,
  Phrasing,
  Point,
  ResumeEntry,
  ResumeSection,
  Store,
  Tag,
  Uuid,
} from "@keepcv/schema";
import {
  careerRecordSchema,
  contactChannelSchema,
  metricSchema,
  organisationSchema,
  phrasingRevisionSchema,
  phrasingSchema,
  phrasingSetSchema,
  pointSchema,
  recordFieldSchema,
  recordLinkSchema,
  resumeEntryPointSchema,
  resumeEntrySchema,
  resumeSchema,
  resumeSectionSchema,
  storeSchema,
  tagSchema,
} from "@keepcv/schema";
import { newUuid } from "../identity/uuid.js";
import { tagSlug } from "../tags/slug.js";

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
    resumes: [],
    resumeSections: [],
    resumeEntries: [],
    resumeEntryPoints: [],
    resumeContactChannels: [],
    savedFilters: [],
    templates: [],
  });
}

// A kind's own columns are required keys that happen to be nullable, so a body
// missing them is not a record of that kind at all.
const columnsOfKind: Record<string, Record<string, unknown>> = {
  project: {},
  experience: { employmentType: null, mode: null },
  certification: { credentialId: null, expiresOn: null },
  education: { grade: null, gradeScale: null, thesisTitle: null, honours: null },
  skill: { category: null, proficiency: null },
  language: { proficiency: null },
  award: {},
  volunteering: {},
  speaking: {},
  publication: { doi: null },
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

export function aPhrasing(
  store: Store,
  phrasingSetId: Uuid,
  text: string,
  overrides: Record<string, unknown> = {},
): Phrasing {
  const revisionId = newUuid();
  const phrasing = phrasingSchema.parse({
    ...standard(),
    phrasingSetId,
    variant: "standard",
    label: null,
    sortKey: "a0",
    currentRevisionId: revisionId,
    ...overrides,
  });

  store.phrasings.push(phrasing);
  store.phrasingRevisions.push(
    phrasingRevisionSchema.parse({
      id: revisionId,
      createdAt: EPOCH,
      phrasingId: phrasing.id,
      body: [{ t: "text", v: text }],
      plainText: text,
      charCount: text.length,
      contentHash: "0".repeat(64),
    }),
  );
  return phrasing;
}

// Appended and the pointer moved, which is the only way text ever changes.
export function reword(store: Store, phrasing: Phrasing, text: string): Phrasing {
  const revision = phrasingRevisionSchema.parse({
    id: newUuid(),
    createdAt: EPOCH,
    phrasingId: phrasing.id,
    body: [{ t: "text", v: text }],
    plainText: text,
    charCount: text.length,
    contentHash: "1".repeat(64),
  });
  store.phrasingRevisions.push(revision);
  phrasing.currentRevisionId = revision.id;
  return phrasing;
}

// A phrasing set with one wording in it, which is the shape a point and a
// summary both reach their words through.
export function aPhrasingSet(store: Store, purpose: string, text: string): Uuid {
  const setId = newUuid();
  store.phrasingSets.push(
    phrasingSetSchema.parse({ ...standard(), id: setId, purpose, canonicalPhrasingId: null }),
  );

  const canonical = aPhrasing(store, setId, text);
  const set = store.phrasingSets.find((row) => row.id === setId);
  if (set !== undefined) set.canonicalPhrasingId = canonical.id;
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
    slug: tagSlug(label),
    label,
    category: null,
    ...overrides,
  });
  store.tags.push(tag);
  return tag;
}

export function aResume(store: Store, name: string, overrides: Record<string, unknown> = {}) {
  const resume = resumeSchema.parse({
    ...standard(),
    name,
    targetCompany: null,
    targetRole: null,
    targetUrl: null,
    targetJdText: null,
    appliedOn: null,
    ...overrides,
  });
  store.resumes.push(resume);
  return resume;
}

export function aSection(
  store: Store,
  resumeId: Uuid,
  kind: string,
  overrides: Record<string, unknown> = {},
) {
  const section = resumeSectionSchema.parse({
    ...standard(),
    resumeId,
    kind,
    customSectionId: null,
    heading: null,
    layout: null,
    sortKey: "a0",
    isVisible: true,
    ...overrides,
  });
  store.resumeSections.push(section);
  return section;
}

export function anEntry(
  store: Store,
  section: ResumeSection,
  recordId: Uuid,
  overrides: Record<string, unknown> = {},
) {
  const entry = resumeEntrySchema.parse({
    ...standard(),
    resumeId: section.resumeId,
    resumeSectionId: section.id,
    recordId,
    sortKey: "a0",
    isVisible: true,
    ...overrides,
  });
  store.resumeEntries.push(entry);
  return entry;
}

export function anEntryPoint(
  store: Store,
  entry: ResumeEntry,
  point: Point,
  overrides: Record<string, unknown> = {},
) {
  const phrasing = store.phrasings.find((row) => row.phrasingSetId === point.phrasingSetId);
  if (phrasing === undefined) throw new Error("a point is written with the wording it holds");

  const entryPoint = resumeEntryPointSchema.parse({
    ...standard(),
    resumeId: entry.resumeId,
    resumeEntryId: entry.id,
    pointId: point.id,
    phrasingId: phrasing.id,
    sortKey: "a0",
    isVisible: true,
    ...overrides,
  });
  store.resumeEntryPoints.push(entryPoint);
  return entryPoint;
}

export function aContactChannel(
  store: Store,
  kind: string,
  value: string,
  overrides: Record<string, unknown> = {},
) {
  const channel = contactChannelSchema.parse({
    ...standard(),
    kind,
    label: null,
    value,
    isDefaultVisible: true,
    sortKey: "a0",
    ...overrides,
  });
  store.contactChannels.push(channel);
  return channel;
}

export function aLink(store: Store, recordId: Uuid, overrides: Record<string, unknown> = {}) {
  const link = recordLinkSchema.parse({
    ...standard(),
    recordId,
    kind: "repo",
    label: null,
    url: "https://example.com/engine",
    sortKey: "a0",
    ...overrides,
  });
  store.recordLinks.push(link);
  return link;
}

export function aField(
  store: Store,
  recordId: Uuid,
  key: string,
  overrides: Record<string, unknown> = {},
) {
  const field = recordFieldSchema.parse({
    ...standard(),
    recordId,
    key,
    label: "Credential ID",
    value: "AWS-1234",
    valueKind: "text",
    sortKey: "a0",
    ...overrides,
  });
  store.recordFields.push(field);
  return field;
}
