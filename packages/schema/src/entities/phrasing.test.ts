import { describe, expect, it } from "vitest";
import {
  phrasingPatchSchema,
  phrasingRevisionSchema,
  phrasingSchema,
  phrasingSetInputSchema,
  phrasingSetPatchSchema,
  phrasingSetSchema,
} from "./phrasing.js";

const id = "019891a4-6ac5-7000-8000-000000000001";
const other = "019891a4-6ac5-7000-8000-000000000002";
const at = "2026-08-08T12:00:00.000Z";

const set = {
  id,
  createdAt: at,
  updatedAt: at,
  archivedAt: null,
  purpose: "profile_summary",
  canonicalPhrasingId: other,
};

const phrasing = {
  id: other,
  createdAt: at,
  updatedAt: at,
  archivedAt: null,
  phrasingSetId: id,
  variant: "standard",
  label: null,
  sortKey: "a0",
  currentRevisionId: null,
};

const revision = {
  id,
  createdAt: at,
  phrasingId: other,
  body: [{ t: "text", v: "Shipped the engine" }],
  plainText: "Shipped the engine",
  charCount: 18,
  contentHash: "a".repeat(64),
};

describe("phrasingSetSchema", () => {
  // The moment between inserting the set and inserting its first phrasing, which
  // is what makes the circular foreign key resolvable (data-model.md #5).
  it("accepts a set that has no canonical phrasing yet", () => {
    expect(phrasingSetSchema.safeParse({ ...set, canonicalPhrasingId: null }).success).toBe(true);
  });

  it("rejects an undeclared purpose", () => {
    expect(phrasingSetSchema.safeParse({ ...set, purpose: "cover_letter" }).success).toBe(false);
  });
});

describe("phrasingSchema", () => {
  it("carries no text, because text lives in revisions", () => {
    expect(Object.keys(phrasingSchema.shape)).not.toContain("body");
  });

  it("accepts a phrasing whose first revision is not written yet", () => {
    expect(phrasingSchema.safeParse(phrasing).success).toBe(true);
  });

  it("rejects an undeclared variant", () => {
    expect(phrasingSchema.safeParse({ ...phrasing, variant: "canonical" }).success).toBe(false);
  });
});

describe("phrasingRevisionSchema", () => {
  it("has no updatedAt and no archivedAt, because it is immutable", () => {
    const keys = Object.keys(phrasingRevisionSchema.shape);
    expect(keys).not.toContain("updatedAt");
    expect(keys).not.toContain("archivedAt");
  });

  it("rejects a hash that is not a lower-case sha-256 digest", () => {
    expect(
      phrasingRevisionSchema.safeParse({ ...revision, contentHash: "A".repeat(64) }).success,
    ).toBe(false);
  });

  it("rejects a link a renderer must never follow", () => {
    const body = [{ t: "a", href: "javascript:alert(1)", c: [{ t: "text", v: "x" }] }];
    expect(phrasingRevisionSchema.safeParse({ ...revision, body }).success).toBe(false);
  });
});

describe("phrasingSetInputSchema", () => {
  // A set with no phrasing is a wording with nothing in it, so the first one is
  // not optional.
  it("refuses a set created without its first phrasing", () => {
    expect(phrasingSetInputSchema.safeParse({ id, purpose: "point" }).success).toBe(false);
  });
});

describe("phrasingPatchSchema", () => {
  it("cannot carry text, so editing wording can only append a revision", () => {
    expect(phrasingPatchSchema.parse({ label: "for platform roles", body: [] })).toEqual({
      label: "for platform roles",
    });
  });
});

describe("phrasingSetPatchSchema", () => {
  it("cannot clear the canonical pointer once a set has one", () => {
    expect(phrasingSetPatchSchema.safeParse({ canonicalPhrasingId: null }).success).toBe(false);
  });
});
