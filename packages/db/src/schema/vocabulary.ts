// Controlled vocabularies are repeated here rather than imported from
// @keepcv/schema: drizzle-kit loads the schema through a CJS require, which
// cannot resolve the package. The vocabulary drift tests feed both sides the
// same values, so a list that grows on one side and not the other fails.
export function quoted(values: string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}
