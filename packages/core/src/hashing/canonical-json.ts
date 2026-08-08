export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export class CanonicalJsonError extends Error {
  override readonly name = "CanonicalJsonError";
}

// Keys sorted by UTF-16 code unit, no insignificant whitespace. Postgres jsonb
// does not preserve the key order it was handed, so a value hashed before the
// write and re-hashed after reading it back would otherwise disagree - and
// every hash-keyed guarantee in the model rests on those two agreeing.
export function canonicalJson(value: JsonValue): string {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new CanonicalJsonError(`${value} has no JSON representation`);
  }
  if (Array.isArray(value)) {
    return `[${value.map((member) => canonicalJson(member)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const members = Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`);
    return `{${members.join(",")}}`;
  }
  return JSON.stringify(value);
}
