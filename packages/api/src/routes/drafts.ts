import { createRoute } from "@hono/zod-openapi";
import type { DraftRepository, UnitOfWork } from "@keepcv/core";
import { draftInputSchema, draftSchema, draftTargetSchema } from "@keepcv/schema";
import { jsonResponse, problemResponse, router, sessionRequired } from "../router.js";
import { jsonBody } from "./collection.js";

// Addressed by what it drafts, because that is its identity: there is no second
// draft of one field, so there is no id to put in a path. There is no GET
// either - the boot payload carries every draft, and an editor asking per field
// would be a round trip answering "no" nearly every time.
const path = "/v1/drafts/{targetKind}/{targetId}/{field}";
const noTarget = problemResponse("no row of this owner has that kind and id");

const save = createRoute({
  method: "put",
  path,
  tags: ["drafts"],
  summary: "Save uncommitted editor state",
  description:
    "Overwrites whatever was there. It carries no concurrency token: the next keystrokes are meant to replace the last ones, and a draft is outside history.",
  request: { params: draftTargetSchema, body: jsonBody(draftInputSchema) },
  responses: {
    ...sessionRequired,
    200: jsonResponse(draftSchema, "the draft as stored"),
    404: noTarget,
    422: problemResponse("the target kind or the field name is not one this store accepts"),
  },
});

const discard = createRoute({
  method: "delete",
  path,
  tags: ["drafts"],
  summary: "Discard a draft",
  description:
    "The one delete in the store, and deliberate: by now the text is either a revision or something the user explicitly abandoned. Discarding a draft that is not there is the same answer.",
  request: { params: draftTargetSchema },
  responses: { ...sessionRequired, 204: { description: "the field has no draft" }, 404: noTarget },
});

export function draftRoutes(unitOfWork: UnitOfWork) {
  const on = async <T>(work: (of: DraftRepository) => Promise<T>): Promise<T> =>
    await unitOfWork.run(async (r) => await work(r.drafts));

  return router()
    .openapi(save, async (c) => {
      const target = c.req.valid("param");
      const { body } = c.req.valid("json");
      return c.json(await on(async (of) => await of.save(target, body)), 200);
    })
    .openapi(discard, async (c) => {
      const target = c.req.valid("param");
      await on(async (of) => {
        await of.discard(target);
      });
      return c.body(null, 204);
    });
}
