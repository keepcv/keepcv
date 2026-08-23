import { describe, expect, it } from "vitest";
import { profilePatchSchema, profileSchema } from "./profile.js";

const profile = {
  id: "019891a4-6ac5-7000-8000-000000000001",
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
  archivedAt: null,
  fullName: "Ada Lovelace",
  pronouns: null,
  headline: null,
  location: null,
  summarySetId: null,
};

describe("profileSchema", () => {
  it("accepts a profile with every optional field empty", () => {
    expect(profileSchema.safeParse({ ...profile, fullName: null }).success).toBe(true);
  });

  it("requires the standard fields", () => {
    const { id: _id, ...withoutId } = profile;
    expect(profileSchema.safeParse(withoutId).success).toBe(false);
  });

  it("carries no owner id", () => {
    // Tenancy comes from ambient scope, never from the payload.
    expect(Object.keys(profileSchema.shape)).not.toContain("ownerId");
  });
});

describe("profilePatchSchema", () => {
  it("distinguishes an absent field from an explicit null", () => {
    expect(profilePatchSchema.parse({})).toEqual({});
    expect(profilePatchSchema.parse({ headline: null })).toEqual({ headline: null });
  });

  it("cannot reach the fields the store owns", () => {
    const patch = profilePatchSchema.parse({ id: "nonsense", fullName: "Ada" });
    expect(patch).toEqual({ fullName: "Ada" });
  });
});
