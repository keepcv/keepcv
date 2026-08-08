/**
 * @keepcv/core
 *
 * Domain logic and invariants. Pure by construction: no filesystem, no
 * database, no network, no Node built-ins. It runs unchanged in Node and in
 * the browser, which is what lets the resume preview compile client-side from
 * cached data while the server compiles the same document for export
 * (application-structure.md §2).
 *
 * This constraint is enforced in CI. Do not import a driver here.
 */

export {
  generateKeyBetween,
  generateNKeysBetween,
  SortKeyError,
} from "./ordering/sort-key.js";
