import { rm } from "node:fs/promises";
import type { StoreOverview } from "@keepcv/core";
import type { CareerRecord } from "@keepcv/schema";
import { careerRecordSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { MIRROR_NAME } from "./mirror.js";
import { readStatus, type StoreStatus, statusReport } from "./status.js";
import { aStore, BOOTS_REAL_STORES } from "./store.harness.js";

const EPOCH = "2026-01-01T00:00:00.000Z";
const NOW = "2026-08-15T12:00:00.000Z";

// Parsed rather than cast: a fixture the wire format would reject is one the
// report is not actually being tested against.
function aCertification(title: string, expiresOn: string | null): CareerRecord {
  return careerRecordSchema.parse({
    id: "01931f00-0000-7000-8000-000000000001",
    createdAt: EPOCH,
    updatedAt: EPOCH,
    archivedAt: null,
    kind: "certification",
    credentialId: null,
    expiresOn,
    title,
    subtitle: null,
    organisationId: null,
    startedOn: null,
    endedOn: null,
    isCurrent: false,
    location: null,
    sortKey: "a0",
    summarySetId: null,
  });
}

function anOverview(unfinished: Partial<StoreOverview["unfinished"]> = {}): StoreOverview {
  return {
    counts: [],
    totals: { records: 12, points: 30, archived: 4 },
    recentlyEdited: [],
    unfinished: {
      missingEndDate: [],
      pointsWithoutMetrics: [],
      expiringCertifications: [],
      unplacedPoints: [],
      ...unfinished,
    },
  };
}

function aStatus(overrides: Partial<StoreStatus> = {}): StoreStatus {
  return {
    dataDir: "/home/ada/.keepcv",
    resumes: 3,
    templates: 1,
    overview: anOverview(),
    mirror: undefined,
    hasPassword: false,
    ...overrides,
  };
}

describe("keepcv status", () => {
  it("counts what the store holds and says where the backup is not", () => {
    const report = statusReport(aStatus(), NOW);

    expect(report).toContain("12 records, 30 points, 3 resumes");
    expect(report).toContain("4 archived, 1 design of your own");
    expect(report).toContain("No backup yet.");
    expect(report).toContain("No password set.");
  });

  it("names the backup file, its size and how long ago it was written", () => {
    const report = statusReport(
      aStatus({
        mirror: {
          path: "/home/ada/.keepcv/store.json",
          bytes: 36_000,
          writtenAt: "2026-08-15T09:00:00.000Z",
        },
      }),
      NOW,
    );

    expect(report).toContain("/home/ada/.keepcv/store.json");
    expect(report).toContain("35 kB, written 3 hours ago");
  });

  it("says a password is set, and where, so --auth password is known to work", () => {
    expect(statusReport(aStatus({ hasPassword: true }), NOW)).toContain("--auth password works");
  });

  it("leaves out what needs nothing doing about it", () => {
    expect(statusReport(aStatus(), NOW)).not.toContain("Worth a look");
  });

  it("pluralises a count of one", () => {
    const report = statusReport(
      aStatus({
        overview: anOverview({ missingEndDate: [aCertification("Anything", null)] }),
      }),
      NOW,
    );

    expect(report).toContain("1 record with no end date");
  });

  it("dates an expiring certification, and copes with one that carries no date", () => {
    const report = statusReport(
      aStatus({
        overview: anOverview({
          expiringCertifications: [
            aCertification("Kubernetes Administrator", "2026-11-02"),
            aCertification("Something Undated", null),
          ],
        }),
      }),
      NOW,
    );

    expect(report).toContain("Kubernetes Administrator expires 2026-11-02");
    expect(report).toContain("Something Undated expires soon");
  });

  it(
    "reads a store that has actually been served",
    async () => {
      const dataDir = await aStore("Ada Lovelace", { resumes: ["Staff engineer", "Founding"] });
      try {
        const status = await readStatus(dataDir, NOW);
        expect(status).toMatchObject({ dataDir, resumes: 2, templates: 0, hasPassword: false });
        expect(status.mirror?.path).toContain(MIRROR_NAME);
        expect(statusReport(status, NOW)).toContain("0 records, 0 points, 2 resumes");
      } finally {
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_REAL_STORES,
  );
});
