import { createRoute } from "@hono/zod-openapi";
import type { TagRepository, UnitOfWork } from "@keepcv/core";
import {
  pointTagSchema,
  recordTagSchema,
  tagInputSchema,
  tagPatchSchema,
  tagSchema,
  type Uuid,
  uuidSchema,
} from "@keepcv/schema";
import { z } from "zod";
import { mutate } from "../problems.js";
import { jsonResponse, problemResponse, router, sessionRequired } from "../router.js";
import { archivedQuery, basedOn, collectionRoutes, idParam, jsonBody } from "./collection.js";

// The assignment routes for both sides live here rather than in the files their
// paths belong to: one vocabulary is one feature to read.
const tags = collectionRoutes({
  path: "/v1/tags",
  tag: "tags",
  noun: "tag",
  dto: tagSchema,
  input: tagInputSchema,
  patch: tagPatchSchema,
  query: archivedQuery,
});

const merge = createRoute({
  method: "post",
  path: "/v1/tags/{id}/merge",
  tags: ["tags"],
  summary: "Merge a tag into another",
  description:
    "Moves everything carrying this tag onto the other one and archives this one. Rows that already carried both keep the one they had.",
  request: { params: idParam, body: jsonBody(basedOn.extend({ intoTagId: uuidSchema })) },
  responses: {
    ...sessionRequired,
    200: jsonResponse(tagSchema, "the tag that was merged away, now archived"),
    404: problemResponse("no tag of this owner has that id"),
    409: problemResponse("the tag changed after it was read"),
    422: problemResponse("a tag cannot be merged into itself"),
  },
});

// Nested because the pair is the whole row, with no id and nothing to patch.
const pairParams = z.object({ id: uuidSchema, tagId: uuidSchema });
const noRecord = problemResponse("no record of this owner has that id");
const noPoint = problemResponse("no point of this owner has that id");
const alreadyTagged = "Idempotent. Repeating it answers with the assignment that is already there.";
const untagging =
  "An assignment holds nothing of its own, so removing one destroys nothing and both ends survive. Untagging something that was never tagged is the same answer.";

const listRecordTags = createRoute({
  method: "get",
  path: "/v1/records/{id}/tags",
  tags: ["tags"],
  summary: "List the tags a record carries",
  request: { params: idParam },
  responses: {
    ...sessionRequired,
    200: jsonResponse(z.object({ items: z.array(recordTagSchema) }), "the record's tags"),
    404: noRecord,
  },
});

const tagRecord = createRoute({
  method: "put",
  path: "/v1/records/{id}/tags/{tagId}",
  tags: ["tags"],
  summary: "Tag a record",
  description: alreadyTagged,
  request: { params: pairParams },
  responses: {
    ...sessionRequired,
    200: jsonResponse(recordTagSchema, "the assignment, new or already there"),
    404: noRecord,
    422: problemResponse("no tag of this owner has that id"),
  },
});

const untagRecord = createRoute({
  method: "delete",
  path: "/v1/records/{id}/tags/{tagId}",
  tags: ["tags"],
  summary: "Take a tag off a record",
  description: untagging,
  request: { params: pairParams },
  responses: {
    ...sessionRequired,
    204: { description: "the record does not carry it" },
    404: noRecord,
  },
});

const listPointTags = createRoute({
  method: "get",
  path: "/v1/points/{id}/tags",
  tags: ["tags"],
  summary: "List the tags a point carries",
  request: { params: idParam },
  responses: {
    ...sessionRequired,
    200: jsonResponse(z.object({ items: z.array(pointTagSchema) }), "the point's tags"),
    404: noPoint,
  },
});

const tagPoint = createRoute({
  method: "put",
  path: "/v1/points/{id}/tags/{tagId}",
  tags: ["tags"],
  summary: "Tag a point",
  description: alreadyTagged,
  request: { params: pairParams },
  responses: {
    ...sessionRequired,
    200: jsonResponse(pointTagSchema, "the assignment, new or already there"),
    404: noPoint,
    422: problemResponse("no tag of this owner has that id"),
  },
});

const untagPoint = createRoute({
  method: "delete",
  path: "/v1/points/{id}/tags/{tagId}",
  tags: ["tags"],
  summary: "Take a tag off a point",
  description: untagging,
  request: { params: pairParams },
  responses: {
    ...sessionRequired,
    204: { description: "the point does not carry it" },
    404: noPoint,
  },
});

export function tagRoutes(unitOfWork: UnitOfWork) {
  const on = async <T>(work: (of: TagRepository) => Promise<T>): Promise<T> =>
    await unitOfWork.run(async (r) => await work(r.tags));

  const read = async (id: Uuid) => await on(async (of) => await of.get(id));

  return router()
    .openapi(tags.list, async (c) => {
      const { archived } = c.req.valid("query");
      const items = await on(
        async (of) => await of.list({ includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(tags.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.create(input)), 201);
    })
    .openapi(tags.read, async (c) => {
      return c.json(await read(c.req.valid("param").id), 200);
    })
    .openapi(tags.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.update(id, patch, expectedUpdatedAt)),
        async () => await read(id),
      );
      return c.json(updated, 200);
    })
    .openapi(tags.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archive(id, expectedUpdatedAt)),
        async () => await read(id),
      );
      return c.json(archived, 200);
    })
    .openapi(tags.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restore(id, expectedUpdatedAt)),
        async () => await read(id),
      );
      return c.json(restored, 200);
    })
    .openapi(merge, async (c) => {
      const { id } = c.req.valid("param");
      const { intoTagId, expectedUpdatedAt } = c.req.valid("json");
      const merged = await mutate(
        async () => await on(async (of) => await of.merge(id, intoTagId, expectedUpdatedAt)),
        async () => await read(id),
      );
      return c.json(merged, 200);
    })

    .openapi(listRecordTags, async (c) => {
      const { id } = c.req.valid("param");
      const items = await unitOfWork.run(async (r) => {
        await r.records.get(id);
        return await r.tags.listRecordTags({ recordId: id });
      });
      return c.json({ items }, 200);
    })
    .openapi(tagRecord, async (c) => {
      const { id, tagId } = c.req.valid("param");
      return c.json(await on(async (of) => await of.tagRecord(id, tagId)), 200);
    })
    .openapi(untagRecord, async (c) => {
      const { id, tagId } = c.req.valid("param");
      await on(async (of) => {
        await of.untagRecord(id, tagId);
      });
      return c.body(null, 204);
    })

    .openapi(listPointTags, async (c) => {
      const { id } = c.req.valid("param");
      const items = await unitOfWork.run(async (r) => {
        await r.points.get(id);
        return await r.tags.listPointTags({ pointId: id });
      });
      return c.json({ items }, 200);
    })
    .openapi(tagPoint, async (c) => {
      const { id, tagId } = c.req.valid("param");
      return c.json(await on(async (of) => await of.tagPoint(id, tagId)), 200);
    })
    .openapi(untagPoint, async (c) => {
      const { id, tagId } = c.req.valid("param");
      await on(async (of) => {
        await of.untagPoint(id, tagId);
      });
      return c.body(null, 204);
    });
}
