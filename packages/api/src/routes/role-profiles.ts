import { createRoute } from "@hono/zod-openapi";
import {
  NotFoundError,
  type RoleProfileRepository,
  roleProfileAdds,
  roleProfilePlan,
  type UnitOfWork,
} from "@keepcv/core";
import {
  roleProfileApplicationSchema,
  roleProfileInputSchema,
  roleProfilePatchSchema,
  roleProfileSchema,
  roleProfileTagSchema,
  type Uuid,
  uuidSchema,
} from "@keepcv/schema";
import { z } from "zod";
import { mutate } from "../problems.js";
import { jsonResponse, problemResponse, router, sessionRequired } from "../router.js";
import { archivedQuery, collectionRoutes, idParam, jsonBody } from "./collection.js";
import { applyCompositionPlan } from "./composition-plan.js";

const profiles = collectionRoutes({
  path: "/v1/role-profiles",
  tag: "role profiles",
  noun: "role profile",
  dto: roleProfileSchema,
  input: roleProfileInputSchema,
  patch: roleProfilePatchSchema,
  query: archivedQuery,
});

const notFound = problemResponse("no role profile of this owner has that id");
const pairParams = z.object({ id: uuidSchema, tagId: uuidSchema });

const listTags = createRoute({
  method: "get",
  path: "/v1/role-profiles/{id}/tags",
  tags: ["role profiles"],
  summary: "List the words a profile selects by",
  request: { params: idParam },
  responses: {
    ...sessionRequired,
    200: jsonResponse(z.object({ items: z.array(roleProfileTagSchema) }), "the profile's rule"),
    404: notFound,
  },
});

const addTag = createRoute({
  method: "put",
  path: "/v1/role-profiles/{id}/tags/{tagId}",
  tags: ["role profiles"],
  summary: "Add a word to a profile",
  description: "Idempotent. Repeating it answers with the rule that is already there.",
  request: { params: pairParams },
  responses: {
    ...sessionRequired,
    200: jsonResponse(roleProfileTagSchema, "the rule, new or already there"),
    404: notFound,
    422: problemResponse("no tag of this owner has that id"),
  },
});

const removeTag = createRoute({
  method: "delete",
  path: "/v1/role-profiles/{id}/tags/{tagId}",
  tags: ["role profiles"],
  summary: "Take a word out of a profile",
  description:
    "A rule holds nothing of its own, so removing one destroys nothing and both ends survive. Removing one that was never there is the same answer.",
  request: { params: pairParams },
  responses: {
    ...sessionRequired,
    204: { description: "the profile does not select by it" },
    404: notFound,
  },
});

const applyProfile = createRoute({
  method: "post",
  path: "/v1/role-profiles/{id}/apply",
  tags: ["role profiles"],
  summary: "Place what a profile selects on a resume",
  description:
    "Additive: it places what the words select and takes nothing off, so a profile applied to a curated resume cannot undo the curation and applying one twice writes nothing the second time.",
  request: { params: idParam, body: jsonBody(z.object({ resumeId: uuidSchema })) },
  responses: {
    ...sessionRequired,
    201: jsonResponse(roleProfileApplicationSchema, "what it placed"),
    404: problemResponse("no role profile or resume of this owner has that id"),
  },
});

export function roleProfileRoutes(unitOfWork: UnitOfWork) {
  const on = async <T>(work: (of: RoleProfileRepository) => Promise<T>): Promise<T> =>
    await unitOfWork.run(async (r) => await work(r.roleProfiles));

  const read = async (id: Uuid) => await on(async (of) => await of.get(id));

  return (
    router()
      .openapi(profiles.list, async (c) => {
        const { archived } = c.req.valid("query");
        const items = await on(
          async (of) => await of.list({ includeArchived: archived === "include" }),
        );
        return c.json({ items }, 200);
      })
      .openapi(profiles.create, async (c) => {
        return c.json(await on(async (of) => await of.create(c.req.valid("json"))), 201);
      })
      .openapi(profiles.read, async (c) => {
        return c.json(await read(c.req.valid("param").id), 200);
      })
      .openapi(profiles.update, async (c) => {
        const { id } = c.req.valid("param");
        const { patch, expectedUpdatedAt } = c.req.valid("json");
        const updated = await mutate(
          async () => await on(async (of) => await of.update(id, patch, expectedUpdatedAt)),
          async () => await read(id),
        );
        return c.json(updated, 200);
      })
      .openapi(profiles.archive, async (c) => {
        const { id } = c.req.valid("param");
        const { expectedUpdatedAt } = c.req.valid("json");
        const archived = await mutate(
          async () => await on(async (of) => await of.archive(id, expectedUpdatedAt)),
          async () => await read(id),
        );
        return c.json(archived, 200);
      })
      .openapi(profiles.restore, async (c) => {
        const { id } = c.req.valid("param");
        const { expectedUpdatedAt } = c.req.valid("json");
        const restored = await mutate(
          async () => await on(async (of) => await of.restore(id, expectedUpdatedAt)),
          async () => await read(id),
        );
        return c.json(restored, 200);
      })

      .openapi(listTags, async (c) => {
        const { id } = c.req.valid("param");
        const items = await on(async (of) => {
          await of.get(id);
          return await of.listTags({ roleProfileId: id });
        });
        return c.json({ items }, 200);
      })
      .openapi(addTag, async (c) => {
        const { id, tagId } = c.req.valid("param");
        return c.json(await on(async (of) => await of.addTag(id, tagId)), 200);
      })
      .openapi(removeTag, async (c) => {
        const { id, tagId } = c.req.valid("param");
        await on(async (of) => {
          await of.removeTag(id, tagId);
        });
        return c.body(null, 204);
      })

      // Planned server-side from the store it reads, for the reason an intake is:
      // a client-computed list of rows to write is a client deciding what the
      // store contains.
      .openapi(applyProfile, async (c) => {
        const { id } = c.req.valid("param");
        const { resumeId } = c.req.valid("json");

        const applied = await unitOfWork.run(async (r) => {
          await r.roleProfiles.get(id);
          const plan = roleProfilePlan(await r.store.readCurrent(), resumeId, id);
          if (plan === undefined) throw new NotFoundError("resume", resumeId);
          await applyCompositionPlan(r, plan);
          return roleProfileAdds(plan);
        });

        return c.json(applied, 201);
      })
  );
}
