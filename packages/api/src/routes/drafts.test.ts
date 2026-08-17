import { newUuid } from "@keepcv/core";
import {
  type CareerRecord,
  careerRecordSchema,
  type Draft,
  draftSchema,
  PROBLEM_TYPES,
  type Store,
  storeSchema,
} from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { problemOf, type Send, withApi } from "../api.harness.js";

const { send, otherOwner } = withApi();

async function created<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  expect(response.status).toBe(201);
  return schema.parse(await response.json());
}

async function addRecord(): Promise<CareerRecord> {
  return await created(
    await send("POST", "/v1/records", {
      id: newUuid(),
      kind: "project",
      title: "a project",
      subtitle: null,
      organisationId: null,
      startedOn: null,
      endedOn: null,
      isCurrent: false,
      location: null,
      sortKey: "a0",
      summarySetId: null,
    }),
    careerRecordSchema,
  );
}

async function put(target: string, body: unknown): Promise<Response> {
  return await send("PUT", `/v1/drafts/${target}`, { body });
}

async function saved(response: Response): Promise<Draft> {
  expect(response.status).toBe(200);
  return draftSchema.parse(await response.json());
}

async function storeOf(as: Send = send): Promise<Store> {
  const response = await as("GET", "/v1/store");
  expect(response.status).toBe(200);
  return storeSchema.parse(await response.json());
}

describe("drafts", () => {
  it("saves what the editor was holding and answers with it", async () => {
    const record = await addRecord();
    const draft = await saved(await put(`record/${record.id}/title`, { value: "Staff Engineer" }));

    expect(draft).toMatchObject({
      targetKind: "record",
      targetId: record.id,
      field: "title",
      body: { value: "Staff Engineer" },
    });
  });

  // No concurrency token, which besides appending a revision no other write can
  // say: the next keystrokes are meant to replace the last ones.
  it("overwrites without a concurrency token", async () => {
    const record = await addRecord();
    await put(`record/${record.id}/title`, { value: "Engineer" });
    const later = await saved(await put(`record/${record.id}/title`, { value: "Staff Engineer" }));

    expect(later.body).toEqual({ value: "Staff Engineer" });
    expect((await storeOf()).drafts).toEqual([later]);
  });

  // Reopening an editor has to know a draft is waiting before it opens, and the
  // payload it already holds is where it looks - there is no route to ask.
  it("arrives in the boot payload", async () => {
    const record = await addRecord();
    const draft = await saved(await put(`record/${record.id}/title`, { value: "half a title" }));

    expect((await storeOf()).drafts).toEqual([draft]);
  });

  it("discards a draft, and discarding one that is not there is the same answer", async () => {
    const record = await addRecord();
    await put(`record/${record.id}/title`, { value: "half a title" });

    expect((await send("DELETE", `/v1/drafts/record/${record.id}/title`)).status).toBe(204);
    expect((await send("DELETE", `/v1/drafts/record/${record.id}/title`)).status).toBe(204);
    expect((await storeOf()).drafts).toEqual([]);
  });

  // The subject of the request is the row in the path, so a draft of something
  // that is not there is a 404 rather than a validation failure.
  it("answers 404 for a target that does not exist", async () => {
    const problem = await problemOf(await put(`record/${newUuid()}/title`, { value: "nowhere" }));

    expect(problem.status).toBe(404);
    expect(problem.type).toBe(PROBLEM_TYPES.notFound);
  });

  it("refuses a target kind the store has no table for", async () => {
    const problem = await problemOf(await put(`resume/${newUuid()}/heading`, { value: "no" }));

    expect(problem.status).toBe(422);
    expect(problem.errors?.map((issue) => issue.path)).toContain("targetKind");
  });

  // A field name is a path segment the editor chooses, so anything that would
  // not survive one is refused rather than stored and never found again.
  it("refuses a field name that is not a plain path segment", async () => {
    const record = await addRecord();
    const problem = await problemOf(await put(`record/${record.id}/not%20a%20field`, {}));

    expect(problem.status).toBe(422);
    expect(problem.errors?.map((issue) => issue.path)).toContain("field");
  });

  it("keeps one owner's drafts out of another's", async () => {
    const record = await addRecord();
    await put(`record/${record.id}/title`, { value: "mine" });

    expect((await storeOf(await otherOwner())).drafts).toEqual([]);
  });
});
