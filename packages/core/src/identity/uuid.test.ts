import { uuidSchema } from "@keepcv/schema";
import { describe, expect, it, vi } from "vitest";
import { newUuid } from "./uuid.js";

const BATCH = 10_000;

describe("newUuid", () => {
  it("produces a version 7 identifier the schema accepts", () => {
    const uuid = newUuid();
    expect(uuidSchema.safeParse(uuid).success).toBe(true);
    expect(uuid[14]).toBe("7");
    expect("89ab").toContain(uuid[19]);
  });

  it("carries the current time in its leading 48 bits", () => {
    const before = Date.now();
    const timestamp = Number.parseInt(newUuid().replaceAll("-", "").slice(0, 12), 16);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(Date.now());
  });

  it("increases strictly, including within one millisecond", () => {
    const uuids = Array.from({ length: BATCH }, () => newUuid());
    const sorted = [...uuids].sort();
    expect(uuids).toEqual(sorted);
    expect(new Set(uuids).size).toBe(BATCH);
  });

  // The 12-bit counter holds ~3800 identifiers per millisecond, which a bulk
  // import passes and nothing else does. Freezing the clock is the only way to
  // reach the branch that borrows the next millisecond.
  it("keeps ordering when more identifiers are minted than one millisecond holds", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now());
      const uuids = Array.from({ length: 20_000 }, () => newUuid());
      expect(new Set(uuids).size).toBe(20_000);
      expect(uuids).toEqual([...uuids].sort());
    } finally {
      vi.useRealTimers();
    }
  });
});
