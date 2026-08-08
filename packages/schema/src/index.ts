/**
 * @keepcv/schema
 *
 * Every shape shared across layers is defined here once, in Zod, and
 * everything else derives from it: TypeScript types, API validation, form
 * validation, the export file format, and the published JSON Schema
 * (ADR-0007).
 *
 * This package has no dependencies beyond Zod and must never gain any.
 */

export { SORT_KEY_DIGITS, type SortKey, sortKeySchema } from "./primitives/sort-key.js";
