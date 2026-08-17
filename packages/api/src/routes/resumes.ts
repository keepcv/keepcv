import { createRoute } from "@hono/zod-openapi";
import { compile, NotFoundError, type ResumeRepository, type UnitOfWork } from "@keepcv/core";
import {
  resumeContactChannelSchema,
  resumeDocumentSchema,
  resumeEntryInputSchema,
  resumeEntryPatchSchema,
  resumeEntryPointInputSchema,
  resumeEntryPointPatchSchema,
  resumeEntryPointSchema,
  resumeEntrySchema,
  resumeInputSchema,
  resumePatchSchema,
  resumeSchema,
  resumeSectionInputSchema,
  resumeSectionPatchSchema,
  resumeSectionSchema,
  type Uuid,
  uuidSchema,
} from "@keepcv/schema";
import { z } from "zod";
import { mutate } from "../problems.js";
import { jsonResponse, problemResponse, router, sessionRequired } from "../router.js";
import { archivedQuery, collectionRoutes, jsonBody } from "./collection.js";

const resumes = collectionRoutes({
  path: "/v1/resumes",
  tag: "resumes",
  noun: "resume",
  dto: resumeSchema,
  input: resumeInputSchema,
  patch: resumePatchSchema,
  query: archivedQuery,
});

// Flat and narrowed, like a record's links (api-contract.md #3).
const sections = collectionRoutes({
  path: "/v1/resume-sections",
  tag: "resume sections",
  noun: "resume section",
  dto: resumeSectionSchema,
  input: resumeSectionInputSchema,
  patch: resumeSectionPatchSchema,
  query: archivedQuery.extend({ resumeId: uuidSchema.optional() }),
});

const entries = collectionRoutes({
  path: "/v1/resume-entries",
  tag: "resume entries",
  noun: "resume entry",
  dto: resumeEntrySchema,
  input: resumeEntryInputSchema,
  patch: resumeEntryPatchSchema,
  query: archivedQuery.extend({
    resumeId: uuidSchema.optional(),
    resumeSectionId: uuidSchema.optional(),
  }),
});

const entryPoints = collectionRoutes({
  path: "/v1/resume-entry-points",
  tag: "resume entry points",
  noun: "resume entry point",
  dto: resumeEntryPointSchema,
  input: resumeEntryPointInputSchema,
  patch: resumeEntryPointPatchSchema,
  query: archivedQuery.extend({
    resumeId: uuidSchema.optional(),
    resumeEntryId: uuidSchema.optional(),
  }),
});

// Nested because the pair is the whole row, like a tag assignment.
const pairParams = z.object({ id: uuidSchema, contactChannelId: uuidSchema });
const noResume = problemResponse("no resume of this owner has that id");

const listContactChannels = createRoute({
  method: "get",
  path: "/v1/resumes/{id}/contact-channels",
  tags: ["resumes"],
  summary: "List the contact channels a resume overrides",
  description:
    "Only the overrides. A channel with no row here prints according to its own isDefaultVisible.",
  request: { params: z.object({ id: uuidSchema }) },
  responses: {
    ...sessionRequired,
    200: jsonResponse(
      z.object({ items: z.array(resumeContactChannelSchema) }),
      "the overrides this resume carries",
    ),
    404: noResume,
  },
});

const setContactChannel = createRoute({
  method: "put",
  path: "/v1/resumes/{id}/contact-channels/{contactChannelId}",
  tags: ["resumes"],
  summary: "Override whether a contact channel prints on a resume",
  description: "Idempotent, and carries no concurrency token: the pair is the whole row.",
  request: { params: pairParams, body: jsonBody(z.object({ isVisible: z.boolean() })) },
  responses: {
    ...sessionRequired,
    200: jsonResponse(resumeContactChannelSchema, "the override as stored"),
    404: problemResponse("no resume or contact channel of this owner has that id"),
  },
});

const clearContactChannel = createRoute({
  method: "delete",
  path: "/v1/resumes/{id}/contact-channels/{contactChannelId}",
  tags: ["resumes"],
  summary: "Stop overriding a contact channel on a resume",
  description:
    "A revert to the channel's own default rather than a hide, so clearing one that was never overridden is the same answer.",
  request: { params: pairParams },
  responses: {
    ...sessionRequired,
    204: { description: "the resume does not override that channel" },
    404: noResume,
  },
});

// Compiled from the same pure function the browser previews with, so the two
// cannot drift (template-model.md #7).
const readDocument = createRoute({
  method: "get",
  path: "/v1/resumes/{id}/document",
  tags: ["resumes"],
  summary: "Compile a resume into the document every renderer binds to",
  description:
    "Uniform, self-contained and free of store identifiers. Hidden and archived rows are already filtered out, and evidence has no field it could travel in.",
  request: {
    params: z.object({ id: uuidSchema }),
    query: z.object({ locale: z.string().min(2).optional() }),
  },
  responses: {
    ...sessionRequired,
    200: jsonResponse(resumeDocumentSchema, "the compiled document"),
    404: noResume,
  },
});

export function resumeRoutes(unitOfWork: UnitOfWork) {
  const on = async <T>(work: (of: ResumeRepository) => Promise<T>): Promise<T> =>
    await unitOfWork.run(async (r) => await work(r.resumes));

  const readResume = async (id: Uuid) => await on(async (of) => await of.get(id));
  const readSection = async (id: Uuid) => await on(async (of) => await of.getSection(id));
  const readEntry = async (id: Uuid) => await on(async (of) => await of.getEntry(id));
  const readEntryPoint = async (id: Uuid) => await on(async (of) => await of.getEntryPoint(id));

  return router()
    .openapi(resumes.list, async (c) => {
      const { archived } = c.req.valid("query");
      const items = await on(
        async (of) => await of.list({ includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(resumes.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.create(input)), 201);
    })
    .openapi(resumes.read, async (c) => {
      return c.json(await readResume(c.req.valid("param").id), 200);
    })
    .openapi(resumes.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.update(id, patch, expectedUpdatedAt)),
        async () => await readResume(id),
      );
      return c.json(updated, 200);
    })
    .openapi(resumes.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archive(id, expectedUpdatedAt)),
        async () => await readResume(id),
      );
      return c.json(archived, 200);
    })
    .openapi(resumes.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restore(id, expectedUpdatedAt)),
        async () => await readResume(id),
      );
      return c.json(restored, 200);
    })

    .openapi(sections.list, async (c) => {
      const { archived, resumeId } = c.req.valid("query");
      const items = await on(
        async (of) => await of.listSections({ resumeId, includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(sections.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.addSection(input)), 201);
    })
    .openapi(sections.read, async (c) => {
      return c.json(await readSection(c.req.valid("param").id), 200);
    })
    .openapi(sections.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.updateSection(id, patch, expectedUpdatedAt)),
        async () => await readSection(id),
      );
      return c.json(updated, 200);
    })
    .openapi(sections.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archiveSection(id, expectedUpdatedAt)),
        async () => await readSection(id),
      );
      return c.json(archived, 200);
    })
    .openapi(sections.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restoreSection(id, expectedUpdatedAt)),
        async () => await readSection(id),
      );
      return c.json(restored, 200);
    })

    .openapi(entries.list, async (c) => {
      const { archived, resumeId, resumeSectionId } = c.req.valid("query");
      const items = await on(
        async (of) =>
          await of.listEntries({
            resumeId,
            resumeSectionId,
            includeArchived: archived === "include",
          }),
      );
      return c.json({ items }, 200);
    })
    .openapi(entries.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.addEntry(input)), 201);
    })
    .openapi(entries.read, async (c) => {
      return c.json(await readEntry(c.req.valid("param").id), 200);
    })
    .openapi(entries.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.updateEntry(id, patch, expectedUpdatedAt)),
        async () => await readEntry(id),
      );
      return c.json(updated, 200);
    })
    .openapi(entries.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archiveEntry(id, expectedUpdatedAt)),
        async () => await readEntry(id),
      );
      return c.json(archived, 200);
    })
    .openapi(entries.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restoreEntry(id, expectedUpdatedAt)),
        async () => await readEntry(id),
      );
      return c.json(restored, 200);
    })

    .openapi(entryPoints.list, async (c) => {
      const { archived, resumeId, resumeEntryId } = c.req.valid("query");
      const items = await on(
        async (of) =>
          await of.listEntryPoints({
            resumeId,
            resumeEntryId,
            includeArchived: archived === "include",
          }),
      );
      return c.json({ items }, 200);
    })
    .openapi(entryPoints.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.addEntryPoint(input)), 201);
    })
    .openapi(entryPoints.read, async (c) => {
      return c.json(await readEntryPoint(c.req.valid("param").id), 200);
    })
    .openapi(entryPoints.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.updateEntryPoint(id, patch, expectedUpdatedAt)),
        async () => await readEntryPoint(id),
      );
      return c.json(updated, 200);
    })
    .openapi(entryPoints.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archiveEntryPoint(id, expectedUpdatedAt)),
        async () => await readEntryPoint(id),
      );
      return c.json(archived, 200);
    })
    .openapi(entryPoints.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restoreEntryPoint(id, expectedUpdatedAt)),
        async () => await readEntryPoint(id),
      );
      return c.json(restored, 200);
    })

    .openapi(readDocument, async (c) => {
      const { id } = c.req.valid("param");
      const { locale } = c.req.valid("query");
      const store = await unitOfWork.run(async (r) => await r.store.readCurrent());
      const document = compile(store, id, {
        generatedAt: new Date().toISOString(),
        ...(locale === undefined ? {} : { locale }),
      });
      if (document === undefined) throw new NotFoundError("resume", id);
      return c.json(document, 200);
    })
    .openapi(listContactChannels, async (c) => {
      const { id } = c.req.valid("param");
      const items = await on(async (of) => {
        await of.get(id);
        return await of.listContactChannels({ resumeId: id });
      });
      return c.json({ items }, 200);
    })
    .openapi(setContactChannel, async (c) => {
      const { id, contactChannelId } = c.req.valid("param");
      const { isVisible } = c.req.valid("json");
      return c.json(
        await on(async (of) => await of.setContactChannel(id, contactChannelId, isVisible)),
        200,
      );
    })
    .openapi(clearContactChannel, async (c) => {
      const { id, contactChannelId } = c.req.valid("param");
      await on(async (of) => {
        await of.clearContactChannel(id, contactChannelId);
      });
      return c.body(null, 204);
    });
}
