import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CanonicalJsonError, canonicalJson, type JsonValue } from "./canonical-json.js";

// Rebuilds every object with its keys inserted in the opposite order, which is
// the divergence a jsonb round trip introduces.
function reordered(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(reordered);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([key, member]) => [key, reordered(member)]),
    );
  }
  return value;
}

describe("canonicalJson", () => {
  it("emits no insignificant whitespace", () => {
    expect(canonicalJson({ b: [1, 2], a: "x" })).toBe('{"a":"x","b":[1,2]}');
  });

  it("sorts object keys at every depth", () => {
    expect(canonicalJson({ z: { c: 1, b: 2 }, a: 3 })).toBe('{"a":3,"z":{"b":2,"c":1}}');
  });

  it("preserves array order", () => {
    expect(canonicalJson(["c", "a", "b"])).toBe('["c","a","b"]');
  });

  it("sorts keys by code unit rather than by locale", () => {
    // Escaped so the source stays ASCII; the key is U+00E5, which sorts after
    // every ASCII letter by code unit but before "b" in most locales.
    expect(canonicalJson({ a: 1, B: 2, "\u00e5": 3, Z: 4 })).toBe('{"B":2,"Z":4,"a":1,"\u00e5":3}');
  });

  it("rejects numbers with no JSON representation", () => {
    expect(() => canonicalJson(Number.NaN)).toThrow(CanonicalJsonError);
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow(CanonicalJsonError);
    expect(() => canonicalJson({ metric: Number.NaN })).toThrow(CanonicalJsonError);
  });

  it("is unaffected by the order the keys were written in", () => {
    fc.assert(
      fc.property(fc.jsonValue() as fc.Arbitrary<JsonValue>, (value) => {
        expect(canonicalJson(reordered(value))).toBe(canonicalJson(value));
      }),
    );
  });

  // Compared through JSON.stringify rather than against the value itself,
  // because JSON has no negative zero: -0 encodes as "0" and parses back as 0.
  it("loses nothing that JSON.stringify would not also lose", () => {
    fc.assert(
      fc.property(fc.jsonValue() as fc.Arbitrary<JsonValue>, (value) => {
        expect(JSON.parse(canonicalJson(value)) as JsonValue).toEqual(
          JSON.parse(JSON.stringify(value)) as JsonValue,
        );
      }),
    );
  });
});
