// This package must import no I/O of any kind — it runs unchanged in Node and
// in the browser, and CI enforces it (application-structure.md §2).

export {
  generateKeyBetween,
  generateNKeysBetween,
  SortKeyError,
} from "./ordering/sort-key.js";
