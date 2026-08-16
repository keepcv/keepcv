import { newUuid } from "@keepcv/core";
import {
  type CareerRecord,
  careerRecordSchema,
  type Point,
  PROBLEM_TYPES,
  pointSchema,
  pointTagSchema,
  recordTagSchema,
  type Tag,
  tagSchema,
  type Uuid,
} from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { problemOf, withApi } from "../api.harness.js";

const { send } = withApi();

async function created<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  expect(response.status).toBe(201);
  return schema.parse(await response.json());
}

async function items<T>(response: Response, schema: z.ZodType<T>): Promise<T[]> {
  expect(response.status).toBe(200);
  return z.object({ items: z.array(schema) }).parse(await response.json()).items;
}

async function addTag(label: string, category: string | null = null): Promise<Tag> {
  return await created(
    await send("POST", "/v1/tags", { id: newUuid(), label, category }),
    tagSchema,
  );
}

async function addRecord(sortKey: string): Promise<CareerRecord> {
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
      sortKey,
      summarySetId: null,
    }),
    careerRecordSchema,
  );
}

async function addPoint(recordId: Uuid, sortKey: string, text: string): Promise<Point> {
  return await created(
    await send("POST", "/v1/points", {
      id: newUuid(),
      recordId,
      phrasingSetId: newUuid(),
      confidence: "unverified",
      occurredOn: null,
      sortKey,
      phrasing: {
        id: newUuid(),
        variant: "standard",
        label: null,
        sortKey: "a0",
        body: [{ t: "text", v: text }],
      },
    }),
    pointSchema,
  );
}

describe("the tag vocabulary", () => {
  // The slug is not in the input schema at all, so a body carrying one has it
  // dropped at the boundary and the store derives its own from the label.
  it("derives the slug from the label, ignoring one the body sent", async () => {
    expect(await addTag("Distributed Systems", "skill")).toMatchObject({
      slug: "distributed-systems",
      category: "skill",
    });

    const sneaked = await created(
      await send("POST", "/v1/tags", {
        id: newUuid(),
        label: "React",
        category: null,
        slug: "something-else",
      }),
      tagSchema,
    );
    expect(sneaked.slug).toBe("react");
  });

  it("answers 409 when a second label projects to a slug already taken", async () => {
    await addTag("React");
    const clash = await send("POST", "/v1/tags", {
      id: newUuid(),
      label: "  react  ",
      category: null,
    });

    const problem = await problemOf(clash);
    expect(problem.status).toBe(409);
    expect(problem.constraint).toBe("tag_slug_unique");
  });

  it("renames a tag and moves its slug with it", async () => {
    const tag = await addTag("Reakt");
    const renamed = await send("PATCH", `/v1/tags/${tag.id}`, {
      expectedUpdatedAt: tag.updatedAt,
      patch: { label: "React" },
    });

    expect(tagSchema.parse(await renamed.json())).toMatchObject({
      label: "React",
      slug: "react",
    });
  });

  it("archives, keeps the row readable, and restores", async () => {
    const tag = await addTag("React");
    const archived = tagSchema.parse(
      await (
        await send("DELETE", `/v1/tags/${tag.id}`, { expectedUpdatedAt: tag.updatedAt })
      ).json(),
    );
    expect(archived.archivedAt).not.toBeNull();

    expect(await items(await send("GET", "/v1/tags"), tagSchema)).toEqual([]);
    expect((await send("GET", `/v1/tags/${tag.id}`)).status).toBe(200);
    expect(await items(await send("GET", "/v1/tags?archived=include"), tagSchema)).toHaveLength(1);

    const restored = await send("POST", `/v1/tags/${tag.id}/restore`, {
      expectedUpdatedAt: archived.updatedAt,
    });
    expect(tagSchema.parse(await restored.json()).archivedAt).toBeNull();
  });
});

describe("tagging records and points", () => {
  it("tags both sides, repeats without complaint, and untags", async () => {
    const tag = await addTag("React");
    const record = await addRecord("a0");
    const point = await addPoint(record.id, "a0", "Words");

    const assigned = await send("PUT", `/v1/records/${record.id}/tags/${tag.id}`);
    expect(assigned.status).toBe(200);
    expect(recordTagSchema.parse(await assigned.json())).toEqual({
      tagId: tag.id,
      recordId: record.id,
    });
    expect((await send("PUT", `/v1/records/${record.id}/tags/${tag.id}`)).status).toBe(200);
    expect((await send("PUT", `/v1/points/${point.id}/tags/${tag.id}`)).status).toBe(200);

    expect(
      await items(await send("GET", `/v1/records/${record.id}/tags`), recordTagSchema),
    ).toHaveLength(1);
    expect(
      await items(await send("GET", `/v1/points/${point.id}/tags`), pointTagSchema),
    ).toHaveLength(1);

    expect((await send("DELETE", `/v1/records/${record.id}/tags/${tag.id}`)).status).toBe(204);
    expect((await send("DELETE", `/v1/records/${record.id}/tags/${tag.id}`)).status).toBe(204);
    expect(
      await items(await send("GET", `/v1/records/${record.id}/tags`), recordTagSchema),
    ).toEqual([]);
  });

  // An empty list would read as "this record carries no tags", which is a
  // different thing from "there is no such record".
  it("answers 404 for the tags of a record that does not exist", async () => {
    const problem = await problemOf(await send("GET", `/v1/records/${newUuid()}/tags`));
    expect(problem.status).toBe(404);
  });

  it("answers 422 for a tag that does not exist", async () => {
    const record = await addRecord("a0");
    const problem = await problemOf(
      await send("PUT", `/v1/records/${record.id}/tags/${newUuid()}`),
    );
    expect(problem.status).toBe(422);
    expect(problem.constraint).toBe("record_tag_tag_fk");
  });

  it("narrows a record list and a point list by tag", async () => {
    const tag = await addTag("React");
    const tagged = await addRecord("a0");
    await addRecord("a1");
    const point = await addPoint(tagged.id, "a0", "Tagged");
    await addPoint(tagged.id, "a1", "Untagged");
    await send("PUT", `/v1/records/${tagged.id}/tags/${tag.id}`);
    await send("PUT", `/v1/points/${point.id}/tags/${tag.id}`);

    expect(
      (await items(await send("GET", `/v1/records?tag=${tag.id}`), careerRecordSchema)).map(
        (entry) => entry.id,
      ),
    ).toEqual([tagged.id]);
    expect(
      (await items(await send("GET", `/v1/points?tag=${tag.id}`), pointSchema)).map(
        (entry) => entry.id,
      ),
    ).toEqual([point.id]);
  });
});

describe("merging tags", () => {
  it("moves what carried the tag and archives the one merged away", async () => {
    const react = await addTag("React");
    const preact = await addTag("Preact");
    const record = await addRecord("a0");
    await send("PUT", `/v1/records/${record.id}/tags/${preact.id}`);

    const merged = await send("POST", `/v1/tags/${preact.id}/merge`, {
      expectedUpdatedAt: preact.updatedAt,
      intoTagId: react.id,
    });

    expect(tagSchema.parse(await merged.json())).toMatchObject({ id: preact.id });
    expect(
      await items(await send("GET", `/v1/records/${record.id}/tags`), recordTagSchema),
    ).toEqual([{ tagId: react.id, recordId: record.id }]);
    expect((await items(await send("GET", "/v1/tags"), tagSchema)).map((t) => t.id)).toEqual([
      react.id,
    ]);
  });

  // Nothing changed under the caller, so re-reading would not help: the request
  // was wrong when it was sent, and the problem points at the field that says so.
  it("answers 422 for a tag merged into itself", async () => {
    const tag = await addTag("React");
    const problem = await problemOf(
      await send("POST", `/v1/tags/${tag.id}/merge`, {
        expectedUpdatedAt: tag.updatedAt,
        intoTagId: tag.id,
      }),
    );

    expect(problem.status).toBe(422);
    expect(problem.type).toBe(PROBLEM_TYPES.validationFailed);
    expect(problem.errors).toEqual([{ path: "intoTagId", code: "same_tag" }]);
  });

  it("answers 409 with the current tag when the merge is based on a stale read", async () => {
    const react = await addTag("React");
    const preact = await addTag("Preact");
    await send("PATCH", `/v1/tags/${preact.id}`, {
      expectedUpdatedAt: preact.updatedAt,
      patch: { category: "skill" },
    });

    const problem = await problemOf(
      await send("POST", `/v1/tags/${preact.id}/merge`, {
        expectedUpdatedAt: preact.updatedAt,
        intoTagId: react.id,
      }),
    );

    expect(problem.status).toBe(409);
    expect(tagSchema.parse(problem.current)).toMatchObject({ category: "skill" });
  });
});
