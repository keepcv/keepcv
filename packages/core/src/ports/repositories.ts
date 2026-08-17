import type {
  CareerRecord,
  CareerRecordInput,
  CareerRecordKind,
  CareerRecordPatch,
  ContactChannel,
  ContactChannelInput,
  ContactChannelPatch,
  CustomSection,
  CustomSectionInput,
  CustomSectionPatch,
  Draft,
  DraftBody,
  DraftTarget,
  Evidence,
  EvidenceInput,
  EvidencePatch,
  Metric,
  MetricInput,
  MetricPatch,
  Organisation,
  OrganisationInput,
  OrganisationPatch,
  Phrasing,
  PhrasingInput,
  PhrasingPatch,
  PhrasingRevision,
  PhrasingSet,
  PhrasingSetInput,
  PhrasingSetPatch,
  Point,
  PointConfidence,
  PointInput,
  PointPatch,
  PointRecordLink,
  PointTag,
  Profile,
  ProfilePatch,
  RecordField,
  RecordFieldInput,
  RecordFieldPatch,
  RecordLink,
  RecordLinkInput,
  RecordLinkPatch,
  RecordTag,
  Resume,
  ResumeContactChannel,
  ResumeEntry,
  ResumeEntryInput,
  ResumeEntryPatch,
  ResumeEntryPoint,
  ResumeEntryPointInput,
  ResumeEntryPointPatch,
  ResumeInput,
  ResumePatch,
  ResumeSection,
  ResumeSectionInput,
  ResumeSectionPatch,
  RichText,
  Store,
  Tag,
  TagInput,
  TagPatch,
  Timestamp,
  Uuid,
} from "@keepcv/schema";

export class NotFoundError extends Error {
  override readonly name = "NotFoundError";
  readonly entity: string;
  readonly id: Uuid;

  constructor(entity: string, id: Uuid) {
    super(`${entity} ${id} does not exist`);
    this.entity = entity;
    this.id = id;
  }
}

export const CONSTRAINT_KINDS = ["unique", "foreignKey", "check"] as const;

export type ConstraintKind = (typeof CONSTRAINT_KINDS)[number];

// Raised instead of letting a driver error through, so the caller can tell a
// caller mistake from a server fault and answer with the right status.
export class ConstraintViolationError extends Error {
  override readonly name = "ConstraintViolationError";
  readonly kind: ConstraintKind;
  readonly constraint: string;

  constructor(kind: ConstraintKind, constraint: string, options?: { cause?: unknown }) {
    super(`the store refused the write: ${constraint}`, options);
    this.kind = kind;
    this.constraint = constraint;
  }
}

// Carries the timestamp the row actually has, so the caller can show both sides
// rather than one being dropped silently.
export class ConcurrencyConflictError extends Error {
  override readonly name = "ConcurrencyConflictError";
  readonly entity: string;
  readonly id: Uuid;
  readonly currentUpdatedAt: Timestamp;

  constructor(entity: string, id: Uuid, currentUpdatedAt: Timestamp) {
    super(`${entity} ${id} has changed since it was read`);
    this.entity = entity;
    this.id = id;
    this.currentUpdatedAt = currentUpdatedAt;
  }
}

// Not a missing row and not a racing edit: applying the shared fields anyway
// would half-succeed.
export class CareerRecordKindMismatchError extends Error {
  override readonly name = "CareerRecordKindMismatchError";
  readonly id: Uuid;
  readonly expected: CareerRecordKind;
  readonly actual: CareerRecordKind;

  constructor(id: Uuid, expected: CareerRecordKind, actual: CareerRecordKind) {
    super(`record ${id} is a ${actual}, not a ${expected}`);
    this.id = id;
    this.expected = expected;
    this.actual = actual;
  }
}

export interface ProfileRepository {
  get(): Promise<Profile>;
  update(patch: ProfilePatch, expectedUpdatedAt: Timestamp): Promise<Profile>;

  listContactChannels(options?: {
    includeArchived?: boolean | undefined;
  }): Promise<ContactChannel[]>;
  getContactChannel(id: Uuid): Promise<ContactChannel>;
  createContactChannel(input: ContactChannelInput): Promise<ContactChannel>;
  updateContactChannel(
    id: Uuid,
    patch: ContactChannelPatch,
    expectedUpdatedAt: Timestamp,
  ): Promise<ContactChannel>;
  archiveContactChannel(id: Uuid, expectedUpdatedAt: Timestamp): Promise<ContactChannel>;
  restoreContactChannel(id: Uuid, expectedUpdatedAt: Timestamp): Promise<ContactChannel>;
}

// Every `list` here returns a total order: the export round trip compares two
// whole stores, so an unstable one fails it.
export interface OrganisationRepository {
  list(options?: { includeArchived?: boolean | undefined }): Promise<Organisation[]>;
  get(id: Uuid): Promise<Organisation>;
  create(input: OrganisationInput): Promise<Organisation>;
  update(id: Uuid, patch: OrganisationPatch, expectedUpdatedAt: Timestamp): Promise<Organisation>;
  archive(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Organisation>;
  restore(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Organisation>;
}

export interface CustomSectionRepository {
  list(options?: { includeArchived?: boolean | undefined }): Promise<CustomSection[]>;
  get(id: Uuid): Promise<CustomSection>;
  create(input: CustomSectionInput): Promise<CustomSection>;
  update(id: Uuid, patch: CustomSectionPatch, expectedUpdatedAt: Timestamp): Promise<CustomSection>;
  archive(id: Uuid, expectedUpdatedAt: Timestamp): Promise<CustomSection>;
  restore(id: Uuid, expectedUpdatedAt: Timestamp): Promise<CustomSection>;
}

export interface CareerRecordRepository {
  list(options?: {
    kind?: CareerRecordKind | undefined;
    tagId?: Uuid | undefined;
    includeArchived?: boolean | undefined;
  }): Promise<CareerRecord[]>;
  get(id: Uuid): Promise<CareerRecord>;
  create(input: CareerRecordInput): Promise<CareerRecord>;
  update(id: Uuid, patch: CareerRecordPatch, expectedUpdatedAt: Timestamp): Promise<CareerRecord>;
  archive(id: Uuid, expectedUpdatedAt: Timestamp): Promise<CareerRecord>;
  restore(id: Uuid, expectedUpdatedAt: Timestamp): Promise<CareerRecord>;

  listLinks(options?: {
    recordId?: Uuid | undefined;
    includeArchived?: boolean | undefined;
  }): Promise<RecordLink[]>;
  getLink(id: Uuid): Promise<RecordLink>;
  createLink(input: RecordLinkInput): Promise<RecordLink>;
  updateLink(id: Uuid, patch: RecordLinkPatch, expectedUpdatedAt: Timestamp): Promise<RecordLink>;
  archiveLink(id: Uuid, expectedUpdatedAt: Timestamp): Promise<RecordLink>;
  restoreLink(id: Uuid, expectedUpdatedAt: Timestamp): Promise<RecordLink>;

  listFields(options?: {
    recordId?: Uuid | undefined;
    includeArchived?: boolean | undefined;
  }): Promise<RecordField[]>;
  getField(id: Uuid): Promise<RecordField>;
  createField(input: RecordFieldInput): Promise<RecordField>;
  updateField(
    id: Uuid,
    patch: RecordFieldPatch,
    expectedUpdatedAt: Timestamp,
  ): Promise<RecordField>;
  archiveField(id: Uuid, expectedUpdatedAt: Timestamp): Promise<RecordField>;
  restoreField(id: Uuid, expectedUpdatedAt: Timestamp): Promise<RecordField>;
}

// `addRevision` is the only way text changes, which is what stops a version
// pinned in March from silently acquiring June's wording.
export interface PhrasingRepository {
  listSets(options?: { includeArchived?: boolean | undefined }): Promise<PhrasingSet[]>;
  getSet(id: Uuid): Promise<PhrasingSet>;
  createSet(input: PhrasingSetInput): Promise<PhrasingSet>;
  updateSet(id: Uuid, patch: PhrasingSetPatch, expectedUpdatedAt: Timestamp): Promise<PhrasingSet>;
  archiveSet(id: Uuid, expectedUpdatedAt: Timestamp): Promise<PhrasingSet>;
  restoreSet(id: Uuid, expectedUpdatedAt: Timestamp): Promise<PhrasingSet>;

  list(options?: {
    phrasingSetId?: Uuid | undefined;
    includeArchived?: boolean | undefined;
  }): Promise<Phrasing[]>;
  get(id: Uuid): Promise<Phrasing>;
  create(input: PhrasingInput): Promise<Phrasing>;
  update(id: Uuid, patch: PhrasingPatch, expectedUpdatedAt: Timestamp): Promise<Phrasing>;
  archive(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Phrasing>;
  restore(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Phrasing>;

  // No concurrency token, unlike every other write: rejecting a second appended
  // wording is the loss append-only exists to prevent.
  addRevision(phrasingId: Uuid, body: RichText): Promise<PhrasingRevision>;
  listRevisions(options?: {
    phrasingId?: Uuid | undefined;
    currentOnly?: boolean | undefined;
  }): Promise<PhrasingRevision[]>;
}

// Refused rather than stored and deduplicated on every read (data-model.md I16).
export class DuplicatePointRecordLinkError extends Error {
  override readonly name = "DuplicatePointRecordLinkError";
  readonly pointId: Uuid;
  readonly recordId: Uuid;

  constructor(pointId: Uuid, recordId: Uuid) {
    super(`point ${pointId} already prints under record ${recordId}`);
    this.pointId = pointId;
    this.recordId = recordId;
  }
}

// `create` writes five tables, so it is never reachable outside a transaction.
export interface PointRepository {
  list(options?: {
    recordId?: Uuid | undefined;
    confidence?: PointConfidence | undefined;
    tagId?: Uuid | undefined;
    includeArchived?: boolean | undefined;
  }): Promise<Point[]>;
  get(id: Uuid): Promise<Point>;
  create(input: PointInput): Promise<Point>;
  update(id: Uuid, patch: PointPatch, expectedUpdatedAt: Timestamp): Promise<Point>;
  archive(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Point>;
  restore(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Point>;

  // No token and no archive: the pair is the whole row. Promoting a linked
  // record to primary drops the link in the same transaction.
  listRecordLinks(options?: { pointId?: Uuid | undefined }): Promise<PointRecordLink[]>;
  linkRecord(pointId: Uuid, recordId: Uuid): Promise<PointRecordLink>;
  unlinkRecord(pointId: Uuid, recordId: Uuid): Promise<void>;

  listMetrics(options?: {
    pointId?: Uuid | undefined;
    includeArchived?: boolean | undefined;
  }): Promise<Metric[]>;
  getMetric(id: Uuid): Promise<Metric>;
  createMetric(input: MetricInput): Promise<Metric>;
  updateMetric(id: Uuid, patch: MetricPatch, expectedUpdatedAt: Timestamp): Promise<Metric>;
  archiveMetric(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Metric>;
  restoreMetric(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Metric>;

  listEvidence(options?: {
    pointId?: Uuid | undefined;
    includeArchived?: boolean | undefined;
  }): Promise<Evidence[]>;
  getEvidence(id: Uuid): Promise<Evidence>;
  createEvidence(input: EvidenceInput): Promise<Evidence>;
  updateEvidence(id: Uuid, patch: EvidencePatch, expectedUpdatedAt: Timestamp): Promise<Evidence>;
  archiveEvidence(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Evidence>;
  restoreEvidence(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Evidence>;
}

// A caller mistake rather than a clash: there is nothing to re-read.
export class TagMergedIntoItselfError extends Error {
  override readonly name = "TagMergedIntoItselfError";
  readonly id: Uuid;

  constructor(id: Uuid) {
    super(`tag ${id} cannot be merged into itself`);
    this.id = id;
  }
}

// `slug` is derived from the label on every write, so no method takes one.
export interface TagRepository {
  list(options?: { includeArchived?: boolean | undefined }): Promise<Tag[]>;
  get(id: Uuid): Promise<Tag>;
  create(input: TagInput): Promise<Tag>;
  update(id: Uuid, patch: TagPatch, expectedUpdatedAt: Timestamp): Promise<Tag>;
  archive(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Tag>;
  restore(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Tag>;
  // Answers with the tag that was merged away, as archiving it alone would.
  merge(id: Uuid, intoTagId: Uuid, expectedUpdatedAt: Timestamp): Promise<Tag>;

  // No token and no archive on any of the four: the pair is the whole row.
  listRecordTags(options?: {
    recordId?: Uuid | undefined;
    tagId?: Uuid | undefined;
  }): Promise<RecordTag[]>;
  tagRecord(recordId: Uuid, tagId: Uuid): Promise<RecordTag>;
  untagRecord(recordId: Uuid, tagId: Uuid): Promise<void>;

  listPointTags(options?: {
    pointId?: Uuid | undefined;
    tagId?: Uuid | undefined;
  }): Promise<PointTag[]>;
  tagPoint(pointId: Uuid, tagId: Uuid): Promise<PointTag>;
  untagPoint(pointId: Uuid, tagId: Uuid): Promise<void>;
}

// Keyed by what it drafts. `save` overwrites and takes no token; `discard` is
// the one delete the store performs (data-model.md #5).
// A selection over the store, and one aggregate: sections, entries and the
// points under them have no life apart from the resume they compose
// (data-model.md #9.1). Every row carries `resumeId` so its parent reference can
// include it, which is what makes I13 and I15 foreign keys rather than checks.
export interface ResumeRepository {
  list(options?: { includeArchived?: boolean | undefined }): Promise<Resume[]>;
  get(id: Uuid): Promise<Resume>;
  create(input: ResumeInput): Promise<Resume>;
  update(id: Uuid, patch: ResumePatch, expectedUpdatedAt: Timestamp): Promise<Resume>;
  archive(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Resume>;
  restore(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Resume>;

  // Nothing below deletes. Toggling a record out of a resume sets `isVisible`,
  // so the phrasing choice and the position it had survive the toggle.
  listSections(options?: {
    resumeId?: Uuid | undefined;
    includeArchived?: boolean | undefined;
  }): Promise<ResumeSection[]>;
  addSection(input: ResumeSectionInput): Promise<ResumeSection>;
  updateSection(
    id: Uuid,
    patch: ResumeSectionPatch,
    expectedUpdatedAt: Timestamp,
  ): Promise<ResumeSection>;
  archiveSection(id: Uuid, expectedUpdatedAt: Timestamp): Promise<ResumeSection>;
  restoreSection(id: Uuid, expectedUpdatedAt: Timestamp): Promise<ResumeSection>;

  listEntries(options?: {
    resumeId?: Uuid | undefined;
    resumeSectionId?: Uuid | undefined;
    includeArchived?: boolean | undefined;
  }): Promise<ResumeEntry[]>;
  addEntry(input: ResumeEntryInput): Promise<ResumeEntry>;
  updateEntry(
    id: Uuid,
    patch: ResumeEntryPatch,
    expectedUpdatedAt: Timestamp,
  ): Promise<ResumeEntry>;
  archiveEntry(id: Uuid, expectedUpdatedAt: Timestamp): Promise<ResumeEntry>;
  restoreEntry(id: Uuid, expectedUpdatedAt: Timestamp): Promise<ResumeEntry>;

  listEntryPoints(options?: {
    resumeId?: Uuid | undefined;
    resumeEntryId?: Uuid | undefined;
    includeArchived?: boolean | undefined;
  }): Promise<ResumeEntryPoint[]>;
  addEntryPoint(input: ResumeEntryPointInput): Promise<ResumeEntryPoint>;
  updateEntryPoint(
    id: Uuid,
    patch: ResumeEntryPointPatch,
    expectedUpdatedAt: Timestamp,
  ): Promise<ResumeEntryPoint>;
  archiveEntryPoint(id: Uuid, expectedUpdatedAt: Timestamp): Promise<ResumeEntryPoint>;
  restoreEntryPoint(id: Uuid, expectedUpdatedAt: Timestamp): Promise<ResumeEntryPoint>;

  // An override: a channel with no row here uses its own `isDefaultVisible`, so
  // clearing one is a revert rather than a hide.
  listContactChannels(options?: { resumeId?: Uuid | undefined }): Promise<ResumeContactChannel[]>;
  setContactChannel(
    resumeId: Uuid,
    contactChannelId: Uuid,
    isVisible: boolean,
  ): Promise<ResumeContactChannel>;
  clearContactChannel(resumeId: Uuid, contactChannelId: Uuid): Promise<void>;
}

export interface DraftRepository {
  list(): Promise<Draft[]>;
  save(target: DraftTarget, body: DraftBody): Promise<Draft>;
  discard(target: DraftTarget): Promise<void>;
}

// Merging two stores needs a review step in front of it, so this refuses rather
// than guessing which side of a clash to keep.
export class StoreNotEmptyError extends Error {
  override readonly name = "StoreNotEmptyError";
  readonly collection: string;

  constructor(collection: string) {
    super(`an import needs an empty store, and this one already holds ${collection}`);
    this.collection = collection;
  }
}

// `load` restores ids and timestamps intact, which is what makes I10 hold and
// why it is the one write that bypasses the concurrency token.
export interface StoreRepository {
  read(): Promise<Store>;
  // The same shape minus superseded wordings: history grows without bound and
  // the boot payload must not (api-contract.md #3).
  readCurrent(): Promise<Store>;
  load(store: Store): Promise<void>;
}

// Every key of a `list` option bag is `| undefined` as well as optional: under
// `exactOptionalPropertyTypes` those are different types.
export interface Repositories {
  profile: ProfileRepository;
  organisations: OrganisationRepository;
  customSections: CustomSectionRepository;
  records: CareerRecordRepository;
  points: PointRepository;
  phrasings: PhrasingRepository;
  tags: TagRepository;
  resumes: ResumeRepository;
  drafts: DraftRepository;
  store: StoreRepository;
}

// The only way to reach a repository: a partial failure mid-point leaves a point
// with no text, so there is no non-transactional path.
export interface UnitOfWork {
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}
