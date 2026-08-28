import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION } from "./export-document.js";
import { migrateDocument, migrations, UnsupportedSchemaVersionError } from "./migrate.js";

const current = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  exportedAt: "2026-08-08T09:41:00Z",
  store: {
    profile: {
      id: "019891a4-6ac5-7000-8000-000000000001",
      createdAt: "2026-08-08T09:41:00Z",
      updatedAt: "2026-08-08T09:41:00Z",
      archivedAt: null,
      fullName: "Ada Lovelace",
      pronouns: null,
      headline: null,
      location: null,
      summarySetId: null,
    },
    contactChannels: [],
    organisations: [],
    customSections: [],
    records: [],
    recordLinks: [],
    recordFields: [],
    phrasingSets: [],
    phrasings: [],
    phrasingRevisions: [],
    points: [],
    pointRecordLinks: [],
    metrics: [],
    evidence: [],
    tags: [],
    recordTags: [],
    pointTags: [],
    drafts: [],
    resumes: [],
    resumeSections: [],
    resumeEntries: [],
    resumeEntryPoints: [],
    resumeContactChannels: [],
    savedFilters: [],
    roleProfiles: [],
    roleProfileTags: [],
    templates: [],
    resumeVersions: [],
    resumeSnapshots: [],
  },
};

describe("migrations", () => {
  it("form a contiguous chain ending at the current version", () => {
    for (const [index, migration] of migrations.entries()) {
      expect(migration.to).toBe(migration.from + 1);
      const previous = migrations[index - 1];
      if (previous !== undefined) expect(migration.from).toBe(previous.to);
    }

    const last = migrations.at(-1);
    if (last !== undefined) expect(last.to).toBe(CURRENT_SCHEMA_VERSION);
  });
});

describe("migrateDocument", () => {
  it("returns a current document unchanged", () => {
    expect(migrateDocument(current)).toEqual(current);
  });

  it("drops fields the current schema does not declare", () => {
    expect(migrateDocument({ ...current, leftover: true })).toEqual(current);
  });

  it("refuses a version newer than this build", () => {
    const future = { ...current, schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(() => migrateDocument(future)).toThrow(UnsupportedSchemaVersionError);
  });

  it("refuses a version with no migration path", () => {
    expect(() => migrateDocument({ ...current, schemaVersion: 0 })).toThrow(
      UnsupportedSchemaVersionError,
    );
  });

  it.each([{}, { schemaVersion: "1" }, null, "not a document"])("refuses %o", (document) => {
    expect(() => migrateDocument(document)).toThrow(UnsupportedSchemaVersionError);
  });

  // A malformed body at a version we do understand is a validation failure, not
  // a version problem - the caller has to be able to tell the two apart.
  it("reports a malformed current document as a validation error", () => {
    expect(() => migrateDocument({ ...current, exportedAt: "yesterday" })).not.toThrow(
      UnsupportedSchemaVersionError,
    );
    expect(() => migrateDocument({ ...current, exportedAt: "yesterday" })).toThrow();
  });
});
