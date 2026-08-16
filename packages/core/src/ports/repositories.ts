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

// The store refuses writes no type can rule out: a sort key already taken, a
// parent that was archived away, a column the row's kind may not carry. The port
// raises this rather than letting a driver error through, so the caller can tell
// a caller mistake from a server fault and answer with the right status.
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

// Carries the timestamp the row actually has so the caller can re-read the
// current state and show a comparison. Silently taking the later write is not
// an option in a product whose promise is that nothing written is lost.
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

// A record's kind never changes, so a patch declaring the wrong one is a caller
// working from a stale idea of what the record is - not a missing row and not a
// racing edit. Applying the shared fields anyway would half-succeed.
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

// Contact channels belong to the profile rather than getting a repository of
// their own: there is exactly one profile per owner and the channels are its
// parts, so nothing can hold one without holding the profile it hangs off.
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

// Every `list` returns a total order, so two reads of unchanged data are the
// same list. The export leans on it: a round trip compares two whole stores.
export interface OrganisationRepository {
  list(options?: { includeArchived?: boolean | undefined }): Promise<Organisation[]>;
  get(id: Uuid): Promise<Organisation>;
  create(input: OrganisationInput): Promise<Organisation>;
  update(id: Uuid, patch: OrganisationPatch, expectedUpdatedAt: Timestamp): Promise<Organisation>;
  archive(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Organisation>;
  restore(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Organisation>;
}

// A heading the built-in kinds do not cover, and the parent of the records that
// print under it. Its own repository rather than a part of the record one, for
// the reason an organisation has one: a section outlives every entry in it and
// has an ordering and a lifecycle of its own.
export interface CustomSectionRepository {
  list(options?: { includeArchived?: boolean | undefined }): Promise<CustomSection[]>;
  get(id: Uuid): Promise<CustomSection>;
  create(input: CustomSectionInput): Promise<CustomSection>;
  update(id: Uuid, patch: CustomSectionPatch, expectedUpdatedAt: Timestamp): Promise<CustomSection>;
  archive(id: Uuid, expectedUpdatedAt: Timestamp): Promise<CustomSection>;
  restore(id: Uuid, expectedUpdatedAt: Timestamp): Promise<CustomSection>;
}

// Links and fields hang off records for the reason contact channels hang off the
// profile: they are parts of a record, not aggregates of their own. There is no
// `move`, because a move is a patch of `sortKey` and one way to do a thing beats
// two.
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

// A set and its first phrasing are created together, and the phrasing is created
// with the text it exists to hold, so none of the three tables is ever written
// alone. `addRevision` is the only way text changes: "editing" appends a row and
// moves `currentRevisionId`, which is what stops a resume version pinned in March
// from silently acquiring June's wording.
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

  // No concurrency token, unlike every other write. Two people appending
  // different wordings at once must both keep their text - rejecting the second
  // one is the loss the append-only design exists to prevent - and identical text
  // is the revision that already exists, so it makes the pointer point there.
  addRevision(phrasingId: Uuid, body: RichText): Promise<PhrasingRevision>;
  listRevisions(options?: {
    phrasingId?: Uuid | undefined;
    // Only the revision each phrasing currently points at, which is what a
    // reader wanting text rather than history needs.
    currentOnly?: boolean | undefined;
  }): Promise<PhrasingRevision[]>;
}

// A point's primary record decides where it prints; a secondary link says it
// also relates to a record. Recording both for one record says nothing the
// primary does not, so it is refused rather than stored and then deduplicated on
// every read that wants "the records this point relates to".
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

// Metrics and evidence hang off points for the reason links and fields hang off
// records. A point is created with its phrasing set and that set's first wording,
// so five tables are written before `create` returns and none of them is ever
// written alone.
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

  // No concurrency token and no archive: a link holds nothing of its own, so
  // removing one destroys nothing and both ends of it survive. Making a linked
  // record the primary one drops the link, since the primary already says it.
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

// Merging a tag into itself would move its assignments onto the tag it then
// archives, which is not a merge and not a rename - it is the vocabulary losing
// a word. There is nothing to re-read, so it is a caller mistake, not a clash.
export class TagMergedIntoItselfError extends Error {
  override readonly name = "TagMergedIntoItselfError";
  readonly id: Uuid;

  constructor(id: Uuid) {
    super(`tag ${id} cannot be merged into itself`);
    this.id = id;
  }
}

// A controlled vocabulary shared by records and points, which is why it is one
// repository rather than a part of either: a tag outlives everything carrying
// it, and rename and merge are operations on the word rather than on the rows.
// `slug` is derived from the label on every write, so no method takes one.
export interface TagRepository {
  list(options?: { includeArchived?: boolean | undefined }): Promise<Tag[]>;
  get(id: Uuid): Promise<Tag>;
  create(input: TagInput): Promise<Tag>;
  update(id: Uuid, patch: TagPatch, expectedUpdatedAt: Timestamp): Promise<Tag>;
  archive(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Tag>;
  restore(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Tag>;
  // Moves every assignment onto the other tag and archives this one, so the
  // rows keep a tag and the vocabulary loses a duplicate. Answers with the tag
  // that was merged away, as archiving it on its own would.
  merge(id: Uuid, intoTagId: Uuid, expectedUpdatedAt: Timestamp): Promise<Tag>;

  // No token and no archive on any of the four: the pair is the whole row, so
  // untagging destroys nothing the user wrote and both ends of it survive.
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

// Import loads a whole store or nothing. Merging two stores is the Import
// capability's job and needs a review step in front of it, so this refuses
// rather than guessing which side of a clash to keep.
export class StoreNotEmptyError extends Error {
  override readonly name = "StoreNotEmptyError";
  readonly collection: string;

  constructor(collection: string) {
    super(`an import needs an empty store, and this one already holds ${collection}`);
    this.collection = collection;
  }
}

// The native export, whole and lossless. `read` returns every row the owner has,
// archived ones included; `load` restores them with their ids and timestamps
// intact, which is what makes data-model.md I10 hold and is why this is the one
// write that bypasses the concurrency token.
export interface StoreRepository {
  read(): Promise<Store>;
  // The same shape carrying current state only: every row, archived ones
  // included, but of the phrasing revisions just the one each phrasing points
  // at. Revision history grows without bound and the boot payload must not
  // (api-contract.md #3).
  readCurrent(): Promise<Store>;
  load(store: Store): Promise<void>;
}

// One repository per aggregate, added as the capability that needs it is built
// (api-contract.md #4 lists the full set). No method takes an owner id: the
// implementation reads it from ambient request scope, so forgetting to scope a
// query is not something a caller can do. Every key of a `list` option bag is
// `| undefined` as well as optional: under `exactOptionalPropertyTypes` those are
// different types, and a route handler forwarding a query parameter the request
// did not carry has the second one.
export interface Repositories {
  profile: ProfileRepository;
  organisations: OrganisationRepository;
  customSections: CustomSectionRepository;
  records: CareerRecordRepository;
  points: PointRepository;
  phrasings: PhrasingRepository;
  tags: TagRepository;
  store: StoreRepository;
}

// The only way to reach a repository. Creating a point writes five tables and
// resolves two circular foreign keys (data-model.md #5); a partial failure there
// leaves a point with no text, so there is no non-transactional path.
export interface UnitOfWork {
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}
