import type {
  CareerRecord,
  CareerRecordInput,
  CareerRecordKind,
  CareerRecordPatch,
  ContactChannel,
  ContactChannelInput,
  ContactChannelPatch,
  Organisation,
  OrganisationInput,
  OrganisationPatch,
  Profile,
  ProfilePatch,
  RecordField,
  RecordFieldInput,
  RecordFieldPatch,
  RecordLink,
  RecordLinkInput,
  RecordLinkPatch,
  Store,
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

  listContactChannels(options?: { includeArchived?: boolean }): Promise<ContactChannel[]>;
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
  list(options?: { includeArchived?: boolean }): Promise<Organisation[]>;
  get(id: Uuid): Promise<Organisation>;
  create(input: OrganisationInput): Promise<Organisation>;
  update(id: Uuid, patch: OrganisationPatch, expectedUpdatedAt: Timestamp): Promise<Organisation>;
  archive(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Organisation>;
  restore(id: Uuid, expectedUpdatedAt: Timestamp): Promise<Organisation>;
}

// Links and fields hang off records for the reason contact channels hang off the
// profile: they are parts of a record, not aggregates of their own. There is no
// `move`, because a move is a patch of `sortKey` and one way to do a thing beats
// two.
export interface CareerRecordRepository {
  list(options?: { kind?: CareerRecordKind; includeArchived?: boolean }): Promise<CareerRecord[]>;
  get(id: Uuid): Promise<CareerRecord>;
  create(input: CareerRecordInput): Promise<CareerRecord>;
  update(id: Uuid, patch: CareerRecordPatch, expectedUpdatedAt: Timestamp): Promise<CareerRecord>;
  archive(id: Uuid, expectedUpdatedAt: Timestamp): Promise<CareerRecord>;
  restore(id: Uuid, expectedUpdatedAt: Timestamp): Promise<CareerRecord>;

  listLinks(options?: { recordId?: Uuid; includeArchived?: boolean }): Promise<RecordLink[]>;
  createLink(input: RecordLinkInput): Promise<RecordLink>;
  updateLink(id: Uuid, patch: RecordLinkPatch, expectedUpdatedAt: Timestamp): Promise<RecordLink>;
  archiveLink(id: Uuid, expectedUpdatedAt: Timestamp): Promise<RecordLink>;
  restoreLink(id: Uuid, expectedUpdatedAt: Timestamp): Promise<RecordLink>;

  listFields(options?: { recordId?: Uuid; includeArchived?: boolean }): Promise<RecordField[]>;
  createField(input: RecordFieldInput): Promise<RecordField>;
  updateField(
    id: Uuid,
    patch: RecordFieldPatch,
    expectedUpdatedAt: Timestamp,
  ): Promise<RecordField>;
  archiveField(id: Uuid, expectedUpdatedAt: Timestamp): Promise<RecordField>;
  restoreField(id: Uuid, expectedUpdatedAt: Timestamp): Promise<RecordField>;
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
  load(store: Store): Promise<void>;
}

// One repository per aggregate, added as the capability that needs it is built
// (api-contract.md #4 lists the full set). No method takes an owner id: the
// implementation reads it from ambient request scope, so forgetting to scope a
// query is not something a caller can do.
export interface Repositories {
  profile: ProfileRepository;
  organisations: OrganisationRepository;
  records: CareerRecordRepository;
  store: StoreRepository;
}

// The only way to reach a repository. Creating a point will write five tables
// and resolve two circular foreign keys (data-model.md #5); a partial failure
// there leaves a point with no text, so there is no non-transactional path.
export interface UnitOfWork {
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}
