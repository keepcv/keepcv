import { describe, expect, it } from "vitest";
import { SORT_KEY_DIGITS, sortKeySchema } from "./sort-key.js";

describe("SORT_KEY_DIGITS", () => {
  it("is 62 distinct digits", () => {
    expect(SORT_KEY_DIGITS).toHaveLength(62);
    expect(new Set(SORT_KEY_DIGITS).size).toBe(62);
  });

  it("is in ascending ASCII order", () => {
    // Load-bearing: it is what lets the database use a plain ORDER BY on
    // sort_key and get the same order the application computed.
    expect([...SORT_KEY_DIGITS].sort().join("")).toBe(SORT_KEY_DIGITS);
  });
});

describe("sortKeySchema", () => {
  it("accepts well-formed keys", () => {
    for (const key of ["a0", "a1", "bzz", "Zz", "a0V"]) {
      expect(sortKeySchema.parse(key)).toBe(key);
    }
  });

  it("rejects an empty key", () => {
    expect(sortKeySchema.safeParse("").success).toBe(false);
  });

  it("rejects digits outside base 62", () => {
    // Escaped rather than written literally so the source stays ASCII.
    for (const key of ["a-b", "a b", "a_b", "caf\u00e9", "a.b", "a/b"]) {
      expect(sortKeySchema.safeParse(key).success).toBe(false);
    }
  });

  it("does not enforce structural rules - those belong to @keepcv/core", () => {
    // "0" is lexically valid but structurally meaningless. Storage accepts it;
    // the ordering algorithm is what rejects it.
    expect(sortKeySchema.safeParse("0").success).toBe(true);
  });
});
