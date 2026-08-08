import type {
  ContactChannel,
  ContactChannelInput,
  ContactChannelPatch,
  Profile,
  ProfilePatch,
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

// One repository per aggregate, added as the capability that needs it is built
// (api-contract.md #4 lists the full set). No method takes an owner id: the
// implementation reads it from ambient request scope, so forgetting to scope a
// query is not something a caller can do.
export interface Repositories {
  profile: ProfileRepository;
}

// The only way to reach a repository. Creating a point will write five tables
// and resolve two circular foreign keys (data-model.md #5); a partial failure
// there leaves a point with no text, so there is no non-transactional path.
export interface UnitOfWork {
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}
