import { createRoute } from "@hono/zod-openapi";
import type { PhrasingRepository, UnitOfWork } from "@keepcv/core";
import {
  phrasingInputSchema,
  phrasingPatchSchema,
  phrasingRevisionSchema,
  phrasingSchema,
  phrasingSetInputSchema,
  phrasingSetPatchSchema,
  phrasingSetSchema,
  richTextSchema,
  type Uuid,
  uuidSchema,
} from "@keepcv/schema";
import { z } from "zod";
import { mutate } from "../problems.js";
import { jsonResponse, problemResponse, router, sessionRequired } from "../router.js";
import { archivedQuery, collectionRoutes, idParam, jsonBody } from "./collection.js";

// A set is never created empty: its first phrasing goes in with it.
const sets = collectionRoutes({
  path: "/v1/phrasing-sets",
  tag: "phrasing sets",
  noun: "phrasing set",
  dto: phrasingSetSchema,
  input: phrasingSetInputSchema,
  patch: phrasingSetPatchSchema,
  query: archivedQuery,
});

// No text on the patch: the append-only rule is structural, not a convention.
const phrasings = collectionRoutes({
  path: "/v1/phrasings",
  tag: "phrasings",
  noun: "phrasing",
  dto: phrasingSchema,
  input: phrasingInputSchema,
  patch: phrasingPatchSchema,
  query: archivedQuery.extend({ phrasingSetId: uuidSchema.optional() }),
});

const noPhrasing = problemResponse("no phrasing of this owner has that id");

// The only write with no concurrency token: appending cannot conflict, and text
// the phrasing already holds returns the revision that already says it.
const addRevision = createRoute({
  method: "post",
  path: "/v1/phrasings/{id}/revisions",
  tags: ["phrasings"],
  summary: "Append a revision, changing what a phrasing says",
  request: { params: idParam, body: jsonBody(z.object({ body: richTextSchema })) },
  responses: {
    ...sessionRequired,
    201: jsonResponse(phrasingRevisionSchema, "the revision the phrasing now points at"),
    404: noPhrasing,
    422: problemResponse("the body is not valid rich text"),
  },
});

const listRevisions = createRoute({
  method: "get",
  path: "/v1/phrasings/{id}/revisions",
  tags: ["phrasings"],
  summary: "Read everything a phrasing has ever said",
  description: "Oldest first. Superseded wordings are kept, never overwritten.",
  request: { params: idParam },
  responses: {
    ...sessionRequired,
    200: jsonResponse(
      z.object({ items: z.array(phrasingRevisionSchema) }),
      "every revision of this phrasing, in the order they were written",
    ),
    404: noPhrasing,
  },
});

export function phrasingRoutes(unitOfWork: UnitOfWork) {
  const on = async <T>(work: (of: PhrasingRepository) => Promise<T>): Promise<T> =>
    await unitOfWork.run(async (r) => await work(r.phrasings));

  const readSet = async (id: Uuid) => await on(async (of) => await of.getSet(id));
  const readPhrasing = async (id: Uuid) => await on(async (of) => await of.get(id));

  return router()
    .openapi(sets.list, async (c) => {
      const { archived } = c.req.valid("query");
      const items = await on(
        async (of) => await of.listSets({ includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(sets.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.createSet(input)), 201);
    })
    .openapi(sets.read, async (c) => {
      return c.json(await readSet(c.req.valid("param").id), 200);
    })
    .openapi(sets.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.updateSet(id, patch, expectedUpdatedAt)),
        async () => await readSet(id),
      );
      return c.json(updated, 200);
    })
    .openapi(sets.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archiveSet(id, expectedUpdatedAt)),
        async () => await readSet(id),
      );
      return c.json(archived, 200);
    })
    .openapi(sets.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restoreSet(id, expectedUpdatedAt)),
        async () => await readSet(id),
      );
      return c.json(restored, 200);
    })

    .openapi(phrasings.list, async (c) => {
      const { archived, phrasingSetId } = c.req.valid("query");
      const items = await on(
        async (of) => await of.list({ phrasingSetId, includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(phrasings.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.create(input)), 201);
    })
    .openapi(phrasings.read, async (c) => {
      return c.json(await readPhrasing(c.req.valid("param").id), 200);
    })
    .openapi(phrasings.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.update(id, patch, expectedUpdatedAt)),
        async () => await readPhrasing(id),
      );
      return c.json(updated, 200);
    })
    .openapi(phrasings.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archive(id, expectedUpdatedAt)),
        async () => await readPhrasing(id),
      );
      return c.json(archived, 200);
    })
    .openapi(phrasings.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restore(id, expectedUpdatedAt)),
        async () => await readPhrasing(id),
      );
      return c.json(restored, 200);
    })

    .openapi(addRevision, async (c) => {
      const { id } = c.req.valid("param");
      const { body } = c.req.valid("json");
      return c.json(await on(async (of) => await of.addRevision(id, body)), 201);
    })
    .openapi(listRevisions, async (c) => {
      const { id } = c.req.valid("param");
      const items = await on(async (of) => {
        await of.get(id);
        return await of.listRevisions({ phrasingId: id });
      });
      return c.json({ items }, 200);
    });
}
