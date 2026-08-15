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
  Uuid,
} from "@keepcv/schema";
import { afterAll, beforeAll, beforeEach, describe } from "vitest";
import { runAsOwner } from "../owner-scope.js";
import { openLocalStore, openServerStore, type Store } from "../store.js";

// One suite, every implementation of the port. It asserts the invariants in
// data-model.md #10 rather than the queries, so an implementation that diverges
// fails loudly instead of subtly - which is the whole reason the private cloud
// repository can be a thin adapter rather than a fork.
const connectionString = process.env["DATABASE_URL"];

// Locally the server half is opt-in. In CI it is not: a suite that quietly
// tests one implementation and reports success for both is worse than no suite,
// and it has already happened once - turbo runs tasks in a strict environment
// and dropped DATABASE_URL before it reached vitest.
if (connectionString === undefined && process.env["CI"] !== undefined) {
  throw new Error("DATABASE_URL is unset, so the port would be tested against PGlite only");
}

const BOOTS_A_STORE = 60_000;

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

export type Run = <T>(work: (repositories: Repositories) => Promise<T>) => Promise<T>;

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

    // A WebAssembly start plus every migration, once per file, and CI runs this
    // suite alongside the API package's. The default hook budget is not enough
    // for that many stores booting at once.
    beforeAll(async () => {
      store = open();
      await store.migrate();
    }, BOOTS_A_STORE);

    afterAll(async () => {
      await store.close();
    });

    // Every test gets its own owner rather than a truncated database. Owner
    // scoping is what isolates them, so the isolation under test is the
    // isolation the suite relies on.
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
