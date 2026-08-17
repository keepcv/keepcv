import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXPORT_JSON_SCHEMA_FILE, exportJsonSchema } from "./json-schema.js";

describe("the published JSON Schema", () => {
  // Regenerate in the same commit as any schema change: `schema:emit`.
  it("matches the committed copy", () => {
    const committed = readFileSync(
      new URL(`../schema/${EXPORT_JSON_SCHEMA_FILE}`, import.meta.url),
      "utf8",
    );

    expect(JSON.parse(committed) as unknown).toEqual(exportJsonSchema);
  });
});
