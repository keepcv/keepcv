import { createRoute } from "@hono/zod-openapi";
import type { ProfileRepository, UnitOfWork } from "@keepcv/core";
import {
  contactChannelInputSchema,
  contactChannelPatchSchema,
  contactChannelSchema,
  profilePatchSchema,
  profileSchema,
  type Uuid,
} from "@keepcv/schema";
import { mutate } from "../problems.js";
import { jsonResponse, problemResponse, router, sessionRequired } from "../router.js";
import { archivedQuery, collectionRoutes, jsonBody, patchBody } from "./collection.js";

// One per owner, so it is neither created nor archived and has no id in a path.
const getProfile = createRoute({
  method: "get",
  path: "/v1/profile",
  tags: ["profile"],
  summary: "Read the profile",
  responses: {
    ...sessionRequired,
    200: jsonResponse(profileSchema, "the one profile this owner has"),
  },
});

const patchProfile = createRoute({
  method: "patch",
  path: "/v1/profile",
  tags: ["profile"],
  summary: "Update the profile",
  description: "Absent leaves a field alone; an explicit null clears it.",
  request: { body: jsonBody(patchBody(profilePatchSchema)) },
  responses: {
    ...sessionRequired,
    200: jsonResponse(profileSchema, "the profile as stored"),
    409: problemResponse("the profile changed after it was read; the current state is attached"),
    422: problemResponse("the body is not a valid profile patch"),
  },
});

const channels = collectionRoutes({
  path: "/v1/contact-channels",
  tag: "contact channels",
  noun: "contact channel",
  dto: contactChannelSchema,
  input: contactChannelInputSchema,
  patch: contactChannelPatchSchema,
  query: archivedQuery,
});

export function profileRoutes(unitOfWork: UnitOfWork) {
  const on = async <T>(work: (of: ProfileRepository) => Promise<T>): Promise<T> =>
    await unitOfWork.run(async (r) => await work(r.profile));

  const readProfile = async () => await on(async (of) => await of.get());
  const readChannel = async (id: Uuid) => await on(async (of) => await of.getContactChannel(id));

  return router()
    .openapi(getProfile, async (c) => {
      return c.json(await readProfile(), 200);
    })
    .openapi(patchProfile, async (c) => {
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.update(patch, expectedUpdatedAt)),
        readProfile,
      );
      return c.json(updated, 200);
    })

    .openapi(channels.list, async (c) => {
      const { archived } = c.req.valid("query");
      const items = await on(
        async (of) => await of.listContactChannels({ includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(channels.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.createContactChannel(input)), 201);
    })
    .openapi(channels.read, async (c) => {
      return c.json(await readChannel(c.req.valid("param").id), 200);
    })
    .openapi(channels.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () =>
          await on(async (of) => await of.updateContactChannel(id, patch, expectedUpdatedAt)),
        async () => await readChannel(id),
      );
      return c.json(updated, 200);
    })
    .openapi(channels.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archiveContactChannel(id, expectedUpdatedAt)),
        async () => await readChannel(id),
      );
      return c.json(archived, 200);
    })
    .openapi(channels.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restoreContactChannel(id, expectedUpdatedAt)),
        async () => await readChannel(id),
      );
      return c.json(restored, 200);
    });
}
