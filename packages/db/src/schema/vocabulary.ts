// Repeated rather than imported from @keepcv/schema: drizzle-kit loads this
// through a CJS require and cannot resolve the package. Drift tests cover it.
export function quoted(values: string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}
