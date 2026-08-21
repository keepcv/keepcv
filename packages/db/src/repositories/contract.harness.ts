import { ConstraintViolationError, newUuid, type Repositories } from "@keepcv/core";
import type {
  CareerRecordInput,
  CareerRecordKind,
  ContactChannelInput,
  CustomSectionInput,
  EvidenceInput,
  MetricInput,
  NewPhrasing,
  OrganisationInput,
  PhrasingInput,
  PhrasingSetInput,
  PointInput,
  RecordFieldInput,
  RecordLinkInput,
  ResumeEntryInput,
  ResumeEntryPointInput,
  ResumeInput,
  ResumeSectionInput,
  TagInput,
  Uuid,
} from "@keepcv/schema";
import { afterAll, beforeAll, beforeEach, describe } from "vitest";
import { runAsOwner } from "../owner-scope.js";
import { openLocalStore, openServerStore, type Store } from "../store.js";

// One suite, every implementation of the port: it asserts the invariants in
// data-model.md #10 rather than the queries.
const connectionString = process.env["DATABASE_URL"];

// In CI the server half is not opt-in: turbo runs tasks in a strict environment
// and dropped DATABASE_URL before it reached vitest, once.
if (connectionString === undefined && process.env["CI"] !== undefined) {
  throw new Error("DATABASE_URL is unset, so the port would be tested against PGlite only");
}

export const BOOTS_A_STORE = 60_000;

const drivers: { name: string; open: () => Store }[] = [
  { name: "PGlite", open: () => openLocalStore() },
  ...(connectionString === undefined
    ? []
    : [{ name: "PostgreSQL", open: () => openServerStore({ connectionString }) }]),
];

// Naming the constraint is what stops a test passing because the write failed
// for some other reason - a typo in a column name refuses the row just as well.
export async function violatedConstraint(work: Promise<unknown>): Promise<string | undefined> {
  const thrown = await work.then(
    () => undefined,
    (error: unknown) => error,
  );
  return thrown instanceof ConstraintViolationError ? thrown.constraint : undefined;
}

export function channelInput(sortKey: string, overrides: Partial<ContactChannelInput> = {}) {
  return {
    id: newUuid(),
    kind: "email",
    label: null,
    value: "ada@example.com",
    isDefaultVisible: true,
    sortKey,
    ...overrides,
  } as ContactChannelInput;
}

// One distinctive value per kind-specific column, so a write that drops or
// misplaces one is visible rather than merely null.
export const extrasByKind: Record<CareerRecordKind, Record<string, unknown>> = {
  experience: { employmentType: "Full-time", mode: "remote" },
  education: {
    grade: "First",
    gradeScale: "UK",
    thesisTitle: "On engines",
    honours: "Distinction",
  },
  project: {},
  skill: { category: "Languages", proficiency: "expert" },
  certification: { credentialId: "AWS-1234", expiresOn: "2027-03" },
  publication: { doi: "10.1000/182" },
  award: {},
  language: { proficiency: "C1" },
  volunteering: {},
  speaking: {},
  custom_entry: {},
};

// `custom_entry` is the one kind with a required parent, so anything that walks
// every kind needs a section to hand it - and must hand it to no other kind.
export function parentSection(kind: CareerRecordKind, id: Uuid): Record<string, unknown> {
  return kind === "custom_entry" ? { customSectionId: id } : {};
}

export function recordInput(
  kind: CareerRecordKind,
  sortKey: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: newUuid(),
    kind,
    title: `a ${kind}`,
    subtitle: null,
    organisationId: null,
    startedOn: null,
    endedOn: null,
    isCurrent: false,
    location: null,
    sortKey,
    summarySetId: null,
    ...extrasByKind[kind],
    ...overrides,
  } as CareerRecordInput;
}

export function organisationInput(name: string, overrides: Partial<OrganisationInput> = {}) {
  return {
    id: newUuid(),
    name,
    kind: "company",
    website: null,
    industry: null,
    location: null,
    ...overrides,
  } as OrganisationInput;
}

export function customSectionInput(
  heading: string,
  sortKey: string,
  overrides: Partial<CustomSectionInput> = {},
) {
  return { id: newUuid(), heading, sortKey, ...overrides } as CustomSectionInput;
}

export function linkInput(
  recordId: Uuid,
  sortKey: string,
  overrides: Partial<RecordLinkInput> = {},
) {
  return {
    id: newUuid(),
    recordId,
    kind: "repo",
    label: null,
    url: "https://example.com/engine",
    sortKey,
    ...overrides,
  } as RecordLinkInput;
}

export function fieldInput(
  recordId: Uuid,
  key: string,
  sortKey: string,
  overrides: Partial<RecordFieldInput> = {},
) {
  return {
    id: newUuid(),
    recordId,
    key,
    label: "Credential ID",
    value: "AWS-1234",
    valueKind: "text",
    sortKey,
    ...overrides,
  } as RecordFieldInput;
}

export function newPhrasing(sortKey: string, text: string, overrides: Partial<NewPhrasing> = {}) {
  return {
    id: newUuid(),
    variant: "standard",
    label: null,
    sortKey,
    body: [{ t: "text", v: text }],
    ...overrides,
  } as NewPhrasing;
}

export function phrasingSetInput(purpose: string, first: NewPhrasing) {
  return { id: newUuid(), purpose, phrasing: first } as PhrasingSetInput;
}

export function phrasingInput(
  phrasingSetId: Uuid,
  sortKey: string,
  text: string,
  overrides: Partial<NewPhrasing> = {},
) {
  return { ...newPhrasing(sortKey, text, overrides), phrasingSetId } as PhrasingInput;
}

export function pointInput(
  recordId: Uuid | null,
  sortKey: string,
  text: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: newUuid(),
    recordId,
    phrasingSetId: newUuid(),
    confidence: "unverified",
    occurredOn: null,
    sortKey,
    phrasing: newPhrasing("a0", text),
    ...overrides,
  } as PointInput;
}

export function metricInput(pointId: Uuid, sortKey: string, overrides: Partial<MetricInput> = {}) {
  return {
    id: newUuid(),
    pointId,
    label: "p95 latency",
    value: 120,
    unit: "ms",
    baseline: 800,
    direction: "decrease",
    period: null,
    sortKey,
    ...overrides,
  } as MetricInput;
}

// No slug: it is derived from the label on write, so a caller cannot send one.
export function tagInput(label: string, overrides: Partial<TagInput> = {}) {
  return { id: newUuid(), label, category: null, ...overrides } as TagInput;
}

export function evidenceInput(pointId: Uuid, overrides: Partial<EvidenceInput> = {}) {
  return {
    id: newUuid(),
    pointId,
    kind: "url",
    value: "https://example.com/dashboard",
    note: null,
    ...overrides,
  } as EvidenceInput;
}

export function resumeInput(name: string, overrides: Record<string, unknown> = {}) {
  return {
    id: newUuid(),
    name,
    targetCompany: null,
    targetRole: null,
    targetUrl: null,
    targetJdText: null,
    appliedOn: null,
    templateId: null,
    templateConfig: {},
    ...overrides,
  } as ResumeInput;
}

export function sectionInput(
  resumeId: Uuid,
  kind: string,
  sortKey: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: newUuid(),
    resumeId,
    kind,
    customSectionId: null,
    heading: null,
    layout: null,
    sortKey,
    isVisible: true,
    ...overrides,
  } as ResumeSectionInput;
}

export function entryInput(
  resumeSectionId: Uuid,
  resumeId: Uuid,
  recordId: Uuid,
  sortKey: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: newUuid(),
    resumeId,
    resumeSectionId,
    recordId,
    sortKey,
    isVisible: true,
    ...overrides,
  } as ResumeEntryInput;
}

export function entryPointInput(
  resumeEntryId: Uuid,
  resumeId: Uuid,
  pointId: Uuid,
  phrasingId: Uuid,
  sortKey: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: newUuid(),
    resumeId,
    resumeEntryId,
    pointId,
    phrasingId,
    sortKey,
    isVisible: true,
    ...overrides,
  } as ResumeEntryPointInput;
}

export type Run = <T>(work: (repositories: Repositories) => Promise<T>) => Promise<T>;

export interface Composed {
  resumeId: Uuid;
  sectionId: Uuid;
  entryId: Uuid;
  recordId: Uuid;
  pointId: Uuid;
  phrasingId: Uuid;
}

// A resume with one section, one entry and one point under it: the shape almost
// every composition case starts from.
// `sortKey` because records are unique on it per kind: a second call into one
// owner collides otherwise.
export async function compose(run: Run, name = "Backend, Acme", sortKey = "a0"): Promise<Composed> {
  return await run(async (r) => {
    const resume = await r.resumes.create(resumeInput(name));
    const record = await r.records.create(recordInput("experience", sortKey));
    const point = pointInput(record.id, sortKey, "Cut p95 latency from 800ms to 120ms");
    await r.points.create(point);
    const section = await r.resumes.addSection(sectionInput(resume.id, "experience", "a0"));
    const entry = await r.resumes.addEntry(entryInput(section.id, resume.id, record.id, "a0"));
    await r.resumes.addEntryPoint(
      entryPointInput(entry.id, resume.id, point.id, point.phrasing.id, "a0"),
    );
    return {
      resumeId: resume.id,
      sectionId: section.id,
      entryId: entry.id,
      recordId: record.id,
      pointId: point.id,
      phrasingId: point.phrasing.id,
    };
  });
}

export interface Driver {
  run: Run;
  otherOwner: () => Promise<Run>;
  store: () => Store;
}

export function eachDriver(suite: (driver: Driver) => void): void {
  describe.each(drivers)("$name", ({ open }) => {
    let store: Store;
    let current: Run;

    function asOwner(ownerId: Uuid): Run {
      return async (work) =>
        await runAsOwner(ownerId, async () => await store.unitOfWork.run(work));
    }

    async function mintOwner(): Promise<Run> {
      const ownerId = newUuid();
      await store.createOwner(ownerId);
      return asOwner(ownerId);
    }

    // The default hook budget is not enough for that many stores booting at once.
    beforeAll(async () => {
      store = open();
      await store.migrate();
    }, BOOTS_A_STORE);

    afterAll(async () => {
      await store.close();
    });

    // The isolation under test is the isolation the suite relies on.
    beforeEach(async () => {
      current = await mintOwner();
    });

    suite({
      run: async (work) => await current(work),
      otherOwner: mintOwner,
      store: () => store,
    });
  });
}
