import { describe, expect, it } from "vitest";
import {
  RECORD_FIELD_VALUE_KINDS,
  recordFieldPatchSchema,
  recordFieldSchema,
} from "./record-field.js";
import { RECORD_LINK_KINDS, recordLinkPatchSchema, recordLinkSchema } from "./record-link.js";

const timestamps = {
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
  archivedAt: null,
};

const link = {
  ...timestamps,
  id: "019891a4-6ac5-7000-8000-000000000005",
  recordId: "019891a4-6ac5-7000-8000-000000000003",
  kind: "repo",
  label: null,
  url: "https://github.com/ada/engine",
  sortKey: "a0",
};

const field = {
  ...timestamps,
  id: "019891a4-6ac5-7000-8000-000000000006",
  recordId: "019891a4-6ac5-7000-8000-000000000003",
  key: "credentialId",
  label: "Credential ID",
  value: "AWS-1234",
  valueKind: "text",
  sortKey: "a0",
};

describe("recordLinkSchema", () => {
  it("accepts every declared kind", () => {
    for (const kind of RECORD_LINK_KINDS) {
      expect(recordLinkSchema.safeParse({ ...link, kind }).success).toBe(true);
    }
  });

  it("rejects an undeclared kind", () => {
    expect(recordLinkSchema.safeParse({ ...link, kind: "mirror" }).success).toBe(false);
  });

  it("rejects an empty url, which is the whole of what a link is", () => {
    expect(recordLinkSchema.safeParse({ ...link, url: "" }).success).toBe(false);
  });

  // Moving a link to a different record is not an edit, it is a different link.
  it("cannot be re-parented by a patch", () => {
    expect(recordLinkPatchSchema.parse({ recordId: link.id, label: "Source" })).toEqual({
      label: "Source",
    });
  });
});

describe("recordFieldSchema", () => {
  it("accepts every declared value kind", () => {
    for (const valueKind of RECORD_FIELD_VALUE_KINDS) {
      expect(recordFieldSchema.safeParse({ ...field, valueKind }).success).toBe(true);
    }
  });

  it("rejects an undeclared value kind", () => {
    expect(recordFieldSchema.safeParse({ ...field, valueKind: "boolean" }).success).toBe(false);
  });

  // An empty value is a field the user has started and not finished, which P-A
  // says must save. An empty label is a field nothing can render.
  it("accepts an empty value and rejects an empty label", () => {
    expect(recordFieldSchema.safeParse({ ...field, value: "" }).success).toBe(true);
    expect(recordFieldSchema.safeParse({ ...field, label: "" }).success).toBe(false);
  });

  it("cannot be re-parented by a patch", () => {
    expect(recordFieldPatchSchema.parse({ recordId: field.id, value: "AWS-9999" })).toEqual({
      value: "AWS-9999",
    });
  });
});
