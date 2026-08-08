import { describe, expect, it } from "vitest";
import { timestampSchema } from "./timestamp.js";

describe("timestampSchema", () => {
  it.each(["2026-08-08T09:41:00Z", "2026-08-08T09:41:00.123Z", "2026-08-08T09:41:00+05:30"])(
    "accepts %s",
    (value) => {
      expect(timestampSchema.parse(value)).toBe(value);
    },
  );

  it.each([
    "2026-08-08T09:41:00", // no offset: not an absolute instant
    "2026-08-08",
    "08/08/2026",
  ])("rejects %s", (value) => {
    expect(timestampSchema.safeParse(value).success).toBe(false);
  });
});
