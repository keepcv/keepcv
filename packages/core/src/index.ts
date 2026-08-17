export { captureManifest, type ManifestRef, manifestRefs } from "./document/capture.js";
export { compile } from "./document/compile.js";
export { contactHref, formatMetric, formatPartialDate, formatPeriod } from "./document/format.js";
export { PRESENTED_KINDS, type Presented, present } from "./document/presenters.js";
export { type CompileOptions, renderManifest } from "./document/render.js";
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
  type AppendedVersion,
  CareerRecordKindMismatchError,
  type CareerRecordRepository,
  CONSTRAINT_KINDS,
  ConcurrencyConflictError,
  type ConstraintKind,
  ConstraintViolationError,
  type CustomSectionRepository,
  type DraftRepository,
  DuplicatePointRecordLinkError,
  NotFoundError,
  type OrganisationRepository,
  type PhrasingRepository,
  type PointRepository,
  type ProfileRepository,
  type Repositories,
  type ResumeRepository,
  type ResumeVersionRepository,
  StoreNotEmptyError,
  type StoreRepository,
  TagMergedIntoItselfError,
  type TagRepository,
  type UnitOfWork,
} from "./ports/repositories.js";
export { canonicaliseRichText } from "./richtext/canonicalise.js";
export { projectPlainText } from "./richtext/plain-text.js";
export { type DerivedRevision, deriveRevision } from "./richtext/revision.js";
export { type SearchHit, type SearchSubject, search } from "./store/search.js";
export {
  archived,
  type ComposedEntry,
  type ComposedPoint,
  type ComposedSection,
  type Composition,
  composition,
  draftFor,
  live,
  organisationOf,
  overview,
  pointsOfRecord,
  pointsWithTag,
  type RecordCount,
  recordCounts,
  recordsWithTag,
  type StoreOverview,
  type TagUsage,
  tagsOfPoint,
  tagsOfRecord,
  tagUsage,
  textOfPhrasingSet,
  textOfPoint,
  type Unfinished,
  unplacedPoints,
} from "./store/selectors.js";
export { tagSlug } from "./tags/slug.js";
