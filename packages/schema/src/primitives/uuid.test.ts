import { describe, expect, it } from "vitest";
import { uuidSchema } from "./uuid.js";

describe("uuidSchema", () => {
  it("accepts a UUIDv7", () => {
    const value = "0198b3c4-5e6f-7a8b-9c0d-1e2f3a4b5c6d";
    expect(uuidSchema.parse(value)).toBe(value);
  });

  it.each([
    "f47ac10b-58cc-4372-a567-0e02b2c3d479", // v4
    "not-a-uuid",
    "",
  ])("rejects %s", (value) => {
    expect(uuidSchema.safeParse(value).success).toBe(false);
  });
});
