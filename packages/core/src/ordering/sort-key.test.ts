import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { bySortKey, generateKeyBetween, generateNKeysBetween, SortKeyError } from "./sort-key.js";

describe("generateKeyBetween", () => {
  it("produces the first key for an empty list", () => {
    expect(generateKeyBetween(null, null)).toBe("a0");
  });

  it("orders strictly between its bounds", () => {
    const first = generateKeyBetween(null, null);
    const before = generateKeyBetween(null, first);
    const after = generateKeyBetween(first, null);
    const between = generateKeyBetween(before, first);

    expect(before < first).toBe(true);
    expect(first < after).toBe(true);
    expect(before < between).toBe(true);
    expect(between < first).toBe(true);
  });

  it("can always insert between adjacent keys, however tight the gap", () => {
    let lower: string = generateKeyBetween(null, null);
    const upper = generateKeyBetween(lower, null);

    for (let i = 0; i < 50; i++) {
      const next = generateKeyBetween(lower, upper);
      expect(lower < next).toBe(true);
      expect(next < upper).toBe(true);
      lower = next;
    }
  });

  it("rejects bounds that are out of order", () => {
    const lower = generateKeyBetween(null, null);
    const upper = generateKeyBetween(lower, null);
    expect(() => generateKeyBetween(upper, lower)).toThrow(SortKeyError);
    expect(() => generateKeyBetween(lower, lower)).toThrow(SortKeyError);
  });

  it("rejects lexically malformed keys", () => {
    expect(() => generateKeyBetween("", null)).toThrow();
    expect(() => generateKeyBetween("a-b", null)).toThrow();
  });

  it("rejects structurally malformed keys", () => {
    // No magnitude head.
    expect(() => generateKeyBetween("0", null)).toThrow(SortKeyError);
    // Magnitude claims more digits than the key has.
    expect(() => generateKeyBetween("b0", null)).toThrow(SortKeyError);
    // Fractional part ends with the smallest digit.
    expect(() => generateKeyBetween("a0V0", null)).toThrow(SortKeyError);
  });
});

describe("generateNKeysBetween", () => {
  it("returns nothing for a count of zero", () => {
    expect(generateNKeysBetween(null, null, 0)).toEqual([]);
  });

  it("returns ascending keys within the given bounds", () => {
    const lower = generateKeyBetween(null, null);
    const upper = generateKeyBetween(lower, null);
    const keys = generateNKeysBetween(lower, upper, 20);

    expect(keys).toHaveLength(20);
    expect([...keys].sort()).toEqual(keys);
    expect(lower < keys[0]!).toBe(true);
    expect(keys.at(-1)! < upper).toBe(true);
  });

  it("keeps appended keys short", () => {
    // The magnitude prefix is the whole reason this holds. Without it, a
    // thousand appends produced two-hundred-character keys.
    const keys = generateNKeysBetween(null, null, 1000);
    expect([...keys].sort()).toEqual(keys);
    expect(Math.max(...keys.map((key) => key.length))).toBeLessThanOrEqual(4);
  });

  it("keeps bisected keys short", () => {
    const lower = generateKeyBetween(null, null);
    const upper = generateKeyBetween(lower, null);
    const keys = generateNKeysBetween(lower, upper, 1000);
    expect(Math.max(...keys.map((key) => key.length))).toBeLessThanOrEqual(8);
  });

  it("rejects a negative or fractional count", () => {
    expect(() => generateNKeysBetween(null, null, -1)).toThrow(SortKeyError);
    expect(() => generateNKeysBetween(null, null, 1.5)).toThrow(SortKeyError);
  });
});

describe("ordering invariants", () => {
  it("preserves intended order under arbitrary insertions", () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { minLength: 1, maxLength: 60 }), (positions) => {
        const keys: string[] = [];

        for (const raw of positions) {
          const at = keys.length === 0 ? 0 : raw % (keys.length + 1);
          const lower = at === 0 ? null : keys[at - 1]!;
          const upper = at === keys.length ? null : keys[at]!;
          keys.splice(at, 0, generateKeyBetween(lower, upper));
        }

        // The order the user built must equal lexicographic key order. This is
        // the entire contract the database's ORDER BY relies on.
        expect([...keys].sort()).toEqual(keys);
      }),
      { numRuns: 300 },
    );
  });

  it("survives repeated moves of an existing item", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.nat(), fc.nat()), { minLength: 1, maxLength: 40 }),
        (moves) => {
          const keys = [...generateNKeysBetween(null, null, 8)] as string[];

          for (const [fromRaw, toRaw] of moves) {
            const from = fromRaw % keys.length;
            const to = toRaw % keys.length;
            const without = keys.filter((_, i) => i !== from);
            const lower = to === 0 ? null : without[to - 1]!;
            const upper = to >= without.length ? null : without[to]!;
            without.splice(to, 0, generateKeyBetween(lower, upper));
            keys.length = 0;
            keys.push(...without);
          }

          expect([...keys].sort()).toEqual(keys);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("bySortKey", () => {
  // `"Zz".localeCompare("a0")` is positive, and `Zz` is exactly the key
  // `generateKeyBetween(null, "a0")` produces for a row moved above the first.
  it("orders an upper-case magnitude before a lower-case one", () => {
    const rows = [
      { id: "1", sortKey: "a0" },
      { id: "2", sortKey: generateKeyBetween(null, "a0") },
    ];
    expect([...rows].sort(bySortKey).map((row) => row.id)).toEqual(["2", "1"]);
  });

  it("breaks a tie on the id, so the order does not depend on the input", () => {
    const rows = [
      { id: "b", sortKey: "a0" },
      { id: "a", sortKey: "a0" },
    ];
    expect([...rows].sort(bySortKey).map((row) => row.id)).toEqual(["a", "b"]);
  });
});
