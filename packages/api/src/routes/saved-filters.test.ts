import { newUuid } from "@keepcv/core";
import { PROBLEM_TYPES, type SavedFilter, savedFilterSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { problemOf, type Send, withApi } from "../api.harness.js";

const { send, otherOwner } = withApi();

async function add(
  name: string,
  overrides: Record<string, unknown> = {},
  as: Send = send,
): Promise<Response> {
  return await as("POST", "/v1/saved-filters", {
    id: newUuid(),
    name,
    subject: "record",
    query: "",
    kind: null,
    tagId: null,
    archived: "exclude",
    unfinished: null,
    sortKey: "a0",
    ...overrides,
  });
}

async function created(response: Response): Promise<SavedFilter> {
  expect(response.status).toBe(201);
  return savedFilterSchema.parse(await response.json());
}

async function listed(query: string): Promise<SavedFilter[]> {
  const response = await send("GET", `/v1/saved-filters${query}`);
  expect(response.status).toBe(200);
  return z.object({ items: z.array(savedFilterSchema) }).parse(await response.json()).items;
}

describe("saved filters", () => {
  it("keeps a narrowing under a name and hands it back", async () => {
    const row = await created(
      await add("React experience", { kind: "experience", query: "engine" }),
    );

    expect(row).toMatchObject({
      name: "React experience",
      subject: "record",
      kind: "experience",
      query: "engine",
    });
    expect(await listed("")).toEqual([row]);
  });

  it("narrows the list to the subject asked for", async () => {
    await add("Experience");
    await add("No metric", { subject: "point", unfinished: "unmeasured" });

    expect((await listed("?subject=point")).map((row) => row.name)).toEqual(["No metric"]);
    expect((await listed("?subject=record")).map((row) => row.name)).toEqual(["Experience"]);
  });

  // A record has no `unplaced`, so the store refuses it rather than keeping a
  // filter that narrows by something the record list never reads.
  it("refuses a narrowing the subject has no list for", async () => {
    const problem = await problemOf(await add("Wrong", { unfinished: "unplaced" }));
    expect(problem.type).toBe(PROBLEM_TYPES.constraintViolated);
    expect(problem.constraint).toBe("saved_filter_subject_columns_check");
  });

  it("archives and puts back rather than deleting", async () => {
    const row = await created(await add("React"));

    const gone = await send("DELETE", `/v1/saved-filters/${row.id}`, {
      expectedUpdatedAt: row.updatedAt,
    });
    expect(gone.status).toBe(200);
    expect(await listed("")).toEqual([]);
    expect(await listed("?archived=include")).toHaveLength(1);

    const back = savedFilterSchema.parse(await gone.json());
    const restored = await send("POST", `/v1/saved-filters/${back.id}/restore`, {
      expectedUpdatedAt: back.updatedAt,
    });
    expect(restored.status).toBe(200);
    expect(await listed("")).toHaveLength(1);
  });

  it("answers 409 with the current row when the token is stale", async () => {
    const row = await created(await add("React"));
    await send("PATCH", `/v1/saved-filters/${row.id}`, {
      expectedUpdatedAt: row.updatedAt,
      patch: { name: "Renamed" },
    });

    const problem = await problemOf(
      await send("PATCH", `/v1/saved-filters/${row.id}`, {
        expectedUpdatedAt: row.updatedAt,
        patch: { name: "Again" },
      }),
    );
    expect(problem.type).toBe(PROBLEM_TYPES.staleWrite);
    expect(savedFilterSchema.parse(problem.current).name).toBe("Renamed");
  });

  it("cannot reach another owner's filter", async () => {
    const theirs = await created(await add("Theirs", {}, await otherOwner()));

    expect((await send("GET", `/v1/saved-filters/${theirs.id}`)).status).toBe(404);
    expect(await listed("")).toEqual([]);
  });
});
