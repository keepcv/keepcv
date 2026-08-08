import { describe, expect, it } from "vitest";
import { PARTIAL_DATE_PATTERN, partialDateSchema } from "./partial-date.js";

describe("partialDateSchema", () => {
  it.each(["2019", "2019-03", "2019-03-01", "2019-12-31"])("accepts %s", (value) => {
    expect(partialDateSchema.parse(value)).toBe(value);
  });

  it.each(["19", "2019-3", "2019-13", "2019-00", "2019-03-32", "2019-03-00", "2019-03-01T00:00Z"])(
    "rejects %s",
    (value) => {
      expect(partialDateSchema.safeParse(value).success).toBe(false);
    },
  );

  // Postgres's `~` rejects this; JavaScript's `$` would not.
  it("rejects a trailing newline", () => {
    expect(partialDateSchema.safeParse("2019\n").success).toBe(false);
  });

  it("exposes a pattern the SQL domain can use verbatim", () => {
    expect(PARTIAL_DATE_PATTERN).toBe(
      String.raw`^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$`,
    );
  });
});
