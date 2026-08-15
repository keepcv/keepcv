import { newUuid } from "@keepcv/core";
import { type ExportDocument, exportDocumentSchema, PROBLEM_TYPES } from "@keepcv/schema";
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

describe("export and import", () => {
  // The property the whole format exists for. Ids and timestamps come back
  // verbatim, which is what makes a restored store the same store rather than a
  // copy of its contents.
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

  // Mismatched client and server builds are the normal state of self-hosted
  // software, so a file this build cannot read has to say so rather than
  // half-loading it.
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
