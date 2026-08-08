import { describe, expect, it } from "vitest";
import { contentHashSchema } from "./content-hash.js";

const digest = "a".repeat(64);

describe("contentHashSchema", () => {
  it("accepts a lower-case 64-character hex digest", () => {
    expect(contentHashSchema.parse(digest)).toBe(digest);
  });

  it.each([digest.toUpperCase(), "a".repeat(63), "a".repeat(65), `${"a".repeat(63)}\n`, "zz"])(
    "rejects %s",
    (value) => {
      expect(contentHashSchema.safeParse(value).success).toBe(false);
    },
  );
});
