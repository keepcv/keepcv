// This package must import no I/O of any kind - it runs unchanged in Node and
// in the browser, and CI enforces it (application-structure.md #2).

export {
  CanonicalJsonError,
  canonicalJson,
  type JsonValue,
} from "./hashing/canonical-json.js";
export { contentHash } from "./hashing/content-hash.js";
export { newUuid } from "./identity/uuid.js";
export {
  generateKeyBetween,
  generateNKeysBetween,
  SortKeyError,
} from "./ordering/sort-key.js";
export {
  CareerRecordKindMismatchError,
  type CareerRecordRepository,
  ConcurrencyConflictError,
  type CustomSectionRepository,
  DuplicatePointRecordLinkError,
  NotFoundError,
  type OrganisationRepository,
  type PhrasingRepository,
  type PointRepository,
  type ProfileRepository,
  type Repositories,
  StoreNotEmptyError,
  type StoreRepository,
  type UnitOfWork,
} from "./ports/repositories.js";
export { canonicaliseRichText } from "./richtext/canonicalise.js";
export { projectPlainText } from "./richtext/plain-text.js";
export { type DerivedRevision, deriveRevision } from "./richtext/revision.js";
