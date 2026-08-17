import { newUuid } from "@keepcv/core";
import {
  type ExportDocument,
  exportDocumentSchema,
  PROBLEM_TYPES,
  type Store,
  storeSchema,
} from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { problemOf, type Send, withApi } from "../api.harness.js";

const { send, otherOwner } = withApi();

async function exportVia(caller: Send): Promise<ExportDocument> {
  const response = await caller("GET", "/v1/export");
  expect(response.status).toBe(200);
  return exportDocumentSchema.parse(await response.json());
}

async function aStoreWorthKeeping(): Promise<void> {
  const profile = await (await send("GET", "/v1/profile")).json();
  await send("PATCH", "/v1/profile", {
    fullName: "Ada Lovelace",
    headline: "Mathematician",
    expectedUpdatedAt: (profile as { updatedAt: string }).updatedAt,
  });
  await send("POST", "/v1/contact-channels", {
    id: newUuid(),
    kind: "email",
    label: null,
    value: "ada@example.com",
    isDefaultVisible: true,
    sortKey: "a0",
  });
}

async function storeVia(caller: Send): Promise<Store> {
  const response = await caller("GET", "/v1/store");
  expect(response.status).toBe(200);
  return storeSchema.parse(await response.json());
}

// A record nobody can see any more, and a point whose wording was rewritten:
// the two things the boot payload has to get right.
async function aStoreWithHistory(): Promise<{ phrasingId: string }> {
  const record = (await (
    await send("POST", "/v1/records", {
      id: newUuid(),
      kind: "project",
      title: "Difference Engine",
      subtitle: null,
      organisationId: null,
      startedOn: null,
      endedOn: null,
      isCurrent: false,
      location: null,
      sortKey: "a0",
      summarySetId: null,
    })
  ).json()) as { id: string; updatedAt: string };

  const phrasingId = newUuid();
  await send("POST", "/v1/points", {
    id: newUuid(),
    recordId: record.id,
    phrasingSetId: newUuid(),
    confidence: "unverified",
    occurredOn: null,
    sortKey: "a0",
    phrasing: { id: phrasingId, variant: "standard", label: null, sortKey: "a0", body: [] },
  });
  await send("POST", `/v1/phrasings/${phrasingId}/revisions`, {
    body: [{ t: "text", v: "Rewritten once" }],
  });

  await send("DELETE", `/v1/records/${record.id}`, { expectedUpdatedAt: record.updatedAt });
  return { phrasingId };
}

describe("the boot payload", () => {
  // A phrasing arriving without its current words sends every point back for a
  // request of its own.
  it("carries the wording each phrasing says now, and no superseded one", async () => {
    const { phrasingId } = await aStoreWithHistory();
    const store = await storeVia(send);

    const phrasing = store.phrasings.find((entry) => entry.id === phrasingId);
    expect(store.phrasingRevisions.map((entry) => entry.id)).toEqual([phrasing?.currentRevisionId]);
    expect(store.phrasingRevisions[0]?.plainText).toBe("Rewritten once");
  });

  // The export is the opposite and keeps everything, which is what makes the
  // difference between the two routes worth having.
  it("drops history the export keeps", async () => {
    await aStoreWithHistory();

    expect((await exportVia(send)).store.phrasingRevisions).toHaveLength(2);
    expect((await storeVia(send)).phrasingRevisions).toHaveLength(1);
  });

  // Archived rows are a filter the client applies, never a request it repeats.
  it("carries archived rows, so the toggle needs no refetch", async () => {
    await aStoreWithHistory();
    const store = await storeVia(send);

    expect(store.records).toHaveLength(1);
    expect(store.records[0]?.archivedAt).not.toBeNull();
  });

  it("shows an owner nothing another owner wrote", async () => {
    await aStoreWithHistory();

    expect((await storeVia(await otherOwner())).records).toEqual([]);
  });
});

describe("export and import", () => {
  // Ids and timestamps come back verbatim, or a restored store is only a copy.
  it("round-trips a whole store into an empty one", async () => {
    await aStoreWorthKeeping();
    const exported = await exportVia(send);

    const restore = await otherOwner();
    expect((await restore("POST", "/v1/import", exported)).status).toBe(204);

    expect((await exportVia(restore)).store).toEqual(exported.store);
  });

  it("refuses to load into a store that already holds something", async () => {
    await aStoreWorthKeeping();
    const exported = await exportVia(send);

    const problem = await problemOf(await send("POST", "/v1/import", exported));
    expect(problem.status).toBe(409);
    expect(problem.type).toBe(PROBLEM_TYPES.storeNotEmpty);
  });

  // A file this build cannot read has to say so rather than half-load it.
  it("refuses a document written by a newer build", async () => {
    const exported = await exportVia(send);
    const restore = await otherOwner();

    const problem = await problemOf(
      await restore("POST", "/v1/import", {
        ...exported,
        schemaVersion: exported.schemaVersion + 1,
      }),
    );
    expect(problem.status).toBe(422);
    expect(problem.type).toBe(PROBLEM_TYPES.unsupportedSchemaVersion);
  });

  it("refuses a body that is not an export at all", async () => {
    const restore = await otherOwner();
    const problem = await problemOf(await restore("POST", "/v1/import", { hello: "world" }));
    expect(problem.status).toBe(422);
  });

  // Answering a format this build does not write with native data under the
  // wrong name would be a silent corruption of whatever consumed it.
  it("refuses a format it does not write", async () => {
    expect((await send("GET", "/v1/export?format=jsonresume")).status).toBe(422);
  });
});
