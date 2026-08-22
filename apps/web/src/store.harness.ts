import { newUuid, tagSlug } from "@keepcv/core";
import {
  type CareerRecord,
  careerRecordSchema,
  contactChannelSchema,
  customSectionSchema,
  draftSchema,
  evidenceSchema,
  metricSchema,
  organisationSchema,
  type Phrasing,
  type Point,
  phrasingRevisionSchema,
  phrasingSchema,
  phrasingSetSchema,
  pointSchema,
  type Resume,
  type ResumeEntry,
  type ResumeSection,
  recordFieldSchema,
  recordLinkSchema,
  resumeEntryPointSchema,
  resumeEntrySchema,
  resumeSchema,
  resumeSectionSchema,
  type Store,
  storeSchema,
  type Tag,
  tagSchema,
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
    resumes: [],
    resumeSections: [],
    resumeEntries: [],
    resumeEntryPoints: [],
    resumeContactChannels: [],
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

export function addTag(store: Store, label: string, overrides: Record<string, unknown> = {}): Tag {
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

export function addPhrasing(
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
export function addRevision(store: Store, phrasing: Phrasing, text: string): void {
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

  const index = store.phrasings.findIndex((row) => row.id === phrasing.id);
  const found = store.phrasings[index];
  if (found !== undefined) {
    store.phrasings.splice(index, 1, { ...found, currentRevisionId: revision.id });
  }
}

export function addDraft(store: Store, phrasingId: Uuid, text: string): void {
  store.drafts.push(
    draftSchema.parse({
      targetKind: "phrasing",
      targetId: phrasingId,
      field: "body",
      createdAt: EPOCH,
      updatedAt: EPOCH,
      body: { body: [{ t: "text", v: text }] },
    }),
  );
}

// A point arrives with the words it holds, so the fixture writes all four rows
// of the chain rather than a point on its own.
export function addPoint(
  store: Store,
  text: string,
  overrides: Record<string, unknown> = {},
): Point {
  const setId = newUuid();
  store.phrasingSets.push(
    phrasingSetSchema.parse({
      ...standard({ id: setId }),
      purpose: "point",
      canonicalPhrasingId: null,
    }),
  );
  const canonical = addPhrasing(store, setId, text);
  const set = store.phrasingSets.find((row) => row.id === setId);
  if (set !== undefined) set.canonicalPhrasingId = canonical.id;

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

export function addEvidence(
  store: Store,
  pointId: Uuid,
  overrides: Record<string, unknown> = {},
): void {
  store.evidence.push(
    evidenceSchema.parse({
      ...standard(),
      pointId,
      kind: "url",
      value: "https://private.test/salary-review",
      note: null,
      ...overrides,
    }),
  );
}

export function addContactChannel(store: Store, kind: string, value: string): void {
  store.contactChannels.push(
    contactChannelSchema.parse({
      ...standard(),
      kind,
      label: null,
      value,
      isDefaultVisible: true,
      sortKey: "a0",
    }),
  );
}

export function addResume(store: Store, overrides: Record<string, unknown> = {}): Resume {
  const resume = resumeSchema.parse({
    ...standard(),
    name: "a resume",
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

export function addSection(
  store: Store,
  resumeId: Uuid,
  overrides: Record<string, unknown> = {},
): ResumeSection {
  const section = resumeSectionSchema.parse({
    ...standard(),
    resumeId,
    kind: "experience",
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

export function addEntry(
  store: Store,
  section: ResumeSection,
  recordId: Uuid,
  overrides: Record<string, unknown> = {},
): ResumeEntry {
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

// The phrasing comes from the point's set, so the fixture cannot place a point
// under wording that belongs to a different one.
export function addEntryPoint(
  store: Store,
  entry: ResumeEntry,
  point: Point,
  overrides: Record<string, unknown> = {},
): void {
  const phrasing = store.phrasings.find((row) => row.phrasingSetId === point.phrasingSetId);
  store.resumeEntryPoints.push(
    resumeEntryPointSchema.parse({
      ...standard(),
      resumeId: entry.resumeId,
      resumeEntryId: entry.id,
      pointId: point.id,
      phrasingId: phrasing?.id,
      sortKey: "a0",
      isVisible: true,
      ...overrides,
    }),
  );
}

// One store with something of everything the app has a screen for.
export function aFilledStore(): Store {
  const store = emptyStore();
  store.profile.fullName = "Ada Lovelace";
  store.profile.headline = "Engine lead";
  addContactChannel(store, "email", "ada@example.org");

  const engines = addOrganisation(store, "Analytical Engines");

  const role = addRecord(store, {
    kind: "experience",
    title: "Engine lead",
    organisationId: engines,
    startedOn: "2019-04",
    endedOn: null,
    isCurrent: true,
  });
  const engine = addRecord(store, {
    kind: "project",
    title: "Difference Engine",
    startedOn: "2021",
  });
  addRecord(store, { kind: "project", title: "Shelved idea", archivedAt: EPOCH });

  const measured = addPoint(store, "Cut p95 latency from 800ms to 120ms", { recordId: role.id });
  addMetric(store, measured.id);
  const quiet = addPoint(store, "Rewrote the scheduler", { recordId: role.id, sortKey: "a1" });
  addPoint(store, "Somewhere, eventually");

  const resume = addResume(store, {
    name: "Staff engineer, 2026",
    targetRole: "Staff engineer",
    targetCompany: "Babbage Ltd",
    appliedOn: "2026-02-10",
  });
  const experience = addSection(store, resume.id);
  const entry = addEntry(store, experience, role.id);
  addEntryPoint(store, entry, measured);
  addEntryPoint(store, entry, quiet, { sortKey: "a1", isVisible: false });
  const projects = addSection(store, resume.id, { kind: "project", sortKey: "a1" });
  addEntry(store, projects, engine.id);

  return store;
}

export function addRecordLink(
  store: Store,
  recordId: Uuid,
  overrides: Record<string, unknown> = {},
) {
  store.recordLinks.push(
    recordLinkSchema.parse({
      ...standard(),
      recordId,
      kind: "repo",
      label: null,
      url: "https://github.com/ada/engine",
      sortKey: "a0",
      ...overrides,
    }),
  );
}

export function addRecordField(
  store: Store,
  recordId: Uuid,
  overrides: Record<string, unknown> = {},
) {
  store.recordFields.push(
    recordFieldSchema.parse({
      ...standard(),
      recordId,
      key: "credential-id",
      label: "Credential ID",
      value: "AWS-1234",
      valueKind: "text",
      sortKey: "a0",
      ...overrides,
    }),
  );
}

export function addCustomSection(
  store: Store,
  heading: string,
  overrides: Record<string, unknown> = {},
): Uuid {
  const section = customSectionSchema.parse({
    ...standard(),
    heading,
    sortKey: "a0",
    ...overrides,
  });
  store.customSections.push(section);
  return section.id;
}
