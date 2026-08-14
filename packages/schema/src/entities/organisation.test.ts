import { describe, expect, it } from "vitest";
import { ORGANISATION_KINDS, organisationSchema } from "./organisation.js";

const organisation = {
  id: "019891a4-6ac5-7000-8000-000000000004",
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
  archivedAt: null,
  name: "Analytical Engines Ltd",
  kind: "company",
  website: null,
  industry: null,
  location: null,
};

describe("organisationSchema", () => {
  it("accepts every declared kind", () => {
    for (const kind of ORGANISATION_KINDS) {
      expect(organisationSchema.safeParse({ ...organisation, kind }).success).toBe(true);
    }
  });

  it("rejects an undeclared kind", () => {
    expect(organisationSchema.safeParse({ ...organisation, kind: "charity" }).success).toBe(false);
  });

  // The name is the only thing you always know at the moment you create one, so
  // it is the single NOT NULL that P-A allows here.
  it("rejects an empty name", () => {
    expect(organisationSchema.safeParse({ ...organisation, name: "" }).success).toBe(false);
  });
});
