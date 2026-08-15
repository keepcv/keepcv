import { createRoute } from "@hono/zod-openapi";
import type { UnitOfWork } from "@keepcv/core";
import {
  contactChannelInputSchema,
  contactChannelPatchSchema,
  contactChannelSchema,
  profilePatchSchema,
  profileSchema,
  timestampSchema,
  uuidSchema,
} from "@keepcv/schema";
import { z } from "zod";
import { mutate } from "../problems.js";
import { jsonResponse, problemResponse, router, sessionRequired } from "../router.js";

const idParam = z.object({ id: uuidSchema });

// The concurrency token travels in the body rather than `If-Unmodified-Since`.
// That header has second granularity and `updated_at` is milliseconds, so half
// of every comparison would match a write it should have refused.
const expectedUpdatedAt = timestampSchema;

const basedOn = z.object({ expectedUpdatedAt });

// Archived rows stay reachable: "where did my old channel go" must always have
// an answer, so this is a filter and never a hiding place.
const archivedQuery = z.object({ archived: z.enum(["exclude", "include"]).default("exclude") });

const jsonBody = <Schema extends z.ZodType>(schema: Schema) => ({
  content: { "application/json": { schema } },
});

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
  request: { body: jsonBody(profilePatchSchema.extend({ expectedUpdatedAt })) },
  responses: {
    ...sessionRequired,
    200: jsonResponse(profileSchema, "the profile as stored"),
    409: problemResponse("the profile changed after it was read; the current state is attached"),
    422: problemResponse("the body is not a valid profile patch"),
  },
});

const listChannels = createRoute({
  method: "get",
  path: "/v1/contact-channels",
  tags: ["contact channels"],
  summary: "List contact channels in print order",
  request: { query: archivedQuery },
  responses: {
    ...sessionRequired,
    200: jsonResponse(z.object({ items: z.array(contactChannelSchema) }), "the channels"),
  },
});

const createChannel = createRoute({
  method: "post",
  path: "/v1/contact-channels",
  tags: ["contact channels"],
  summary: "Add a contact channel",
  request: { body: jsonBody(contactChannelInputSchema) },
  responses: {
    ...sessionRequired,
    201: jsonResponse(contactChannelSchema, "the channel as stored"),
    409: problemResponse("the sort key is already taken"),
    422: problemResponse("the body is not a valid contact channel"),
  },
});

const getChannel = createRoute({
  method: "get",
  path: "/v1/contact-channels/{id}",
  tags: ["contact channels"],
  summary: "Read one contact channel, archived or not",
  request: { params: idParam },
  responses: {
    ...sessionRequired,
    200: jsonResponse(contactChannelSchema, "the channel"),
    404: problemResponse("no channel of this owner has that id"),
  },
});

const patchChannel = createRoute({
  method: "patch",
  path: "/v1/contact-channels/{id}",
  tags: ["contact channels"],
  summary: "Update a contact channel",
  request: {
    params: idParam,
    body: jsonBody(contactChannelPatchSchema.extend({ expectedUpdatedAt })),
  },
  responses: {
    ...sessionRequired,
    200: jsonResponse(contactChannelSchema, "the channel as stored"),
    404: problemResponse("no channel of this owner has that id"),
    409: problemResponse("the channel changed after it was read, or the sort key is taken"),
    422: problemResponse("the body is not a valid contact channel patch"),
  },
});

const archiveChannel = createRoute({
  method: "delete",
  path: "/v1/contact-channels/{id}",
  tags: ["contact channels"],
  summary: "Archive a contact channel",
  description: "Archives it. Nothing the user wrote is destroyed and the row stays readable.",
  request: { params: idParam, body: jsonBody(basedOn) },
  responses: {
    ...sessionRequired,
    200: jsonResponse(contactChannelSchema, "the channel, now archived"),
    404: problemResponse("no channel of this owner has that id"),
    409: problemResponse("the channel changed after it was read"),
  },
});

const restoreChannel = createRoute({
  method: "post",
  path: "/v1/contact-channels/{id}/restore",
  tags: ["contact channels"],
  summary: "Restore an archived contact channel",
  request: { params: idParam, body: jsonBody(basedOn) },
  responses: {
    ...sessionRequired,
    200: jsonResponse(contactChannelSchema, "the channel, no longer archived"),
    404: problemResponse("no channel of this owner has that id"),
    409: problemResponse("the channel changed after it was read"),
  },
});

export function profileRoutes(unitOfWork: UnitOfWork) {
  const readChannel = async (id: z.infer<typeof uuidSchema>) =>
    await unitOfWork.run(async (r) => await r.profile.getContactChannel(id));

  return router()
    .openapi(getProfile, async (c) => {
      return c.json(await unitOfWork.run(async (r) => await r.profile.get()), 200);
    })
    .openapi(patchProfile, async (c) => {
      const { expectedUpdatedAt: based, ...patch } = c.req.valid("json");
      const updated = await mutate(
        async () => await unitOfWork.run(async (r) => await r.profile.update(patch, based)),
        async () => await unitOfWork.run(async (r) => await r.profile.get()),
      );
      return c.json(updated, 200);
    })
    .openapi(listChannels, async (c) => {
      const { archived } = c.req.valid("query");
      const items = await unitOfWork.run(
        async (r) =>
          await r.profile.listContactChannels({ includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(createChannel, async (c) => {
      const input = c.req.valid("json");
      const created = await unitOfWork.run(
        async (r) => await r.profile.createContactChannel(input),
      );
      return c.json(created, 201);
    })
    .openapi(getChannel, async (c) => {
      return c.json(await readChannel(c.req.valid("param").id), 200);
    })
    .openapi(patchChannel, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt: based, ...patch } = c.req.valid("json");
      const updated = await mutate(
        async () =>
          await unitOfWork.run(async (r) => await r.profile.updateContactChannel(id, patch, based)),
        async () => await readChannel(id),
      );
      return c.json(updated, 200);
    })
    .openapi(archiveChannel, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt: based } = c.req.valid("json");
      const archived = await mutate(
        async () =>
          await unitOfWork.run(async (r) => await r.profile.archiveContactChannel(id, based)),
        async () => await readChannel(id),
      );
      return c.json(archived, 200);
    })
    .openapi(restoreChannel, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt: based } = c.req.valid("json");
      const restored = await mutate(
        async () =>
          await unitOfWork.run(async (r) => await r.profile.restoreContactChannel(id, based)),
        async () => await readChannel(id),
      );
      return c.json(restored, 200);
    });
}
