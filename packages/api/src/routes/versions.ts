import { createRoute } from "@hono/zod-openapi";
import { captureManifest, NotFoundError, type UnitOfWork } from "@keepcv/core";
import {
  resumeSnapshotInputSchema,
  resumeSnapshotPatchSchema,
  resumeSnapshotSchema,
  resumeVersionSchema,
  type Uuid,
  uuidSchema,
  versionRefSchema,
  versionTriggerSchema,
} from "@keepcv/schema";
import { z } from "zod";
import { mutate } from "../problems.js";
import { jsonResponse, problemResponse, router, sessionRequired } from "../router.js";
import { archivedQuery, collectionRoutes, idParam, jsonBody } from "./collection.js";

// Flat and narrowed, like every other collection keyed by its own id
// (api-contract.md #3). Three routes and not six: a version is immutable.
const versionsPath = "/v1/resume-versions";
const noVersion = problemResponse("no resume version of this owner has that id");

const listVersions = createRoute({
  method: "get",
  path: versionsPath,
  tags: ["resume versions"],
  summary: "List resume versions, oldest first",
  request: { query: z.object({ resumeId: uuidSchema.optional() }) },
  responses: {
    ...sessionRequired,
    200: jsonResponse(
      z.object({ items: z.array(resumeVersionSchema) }),
      "the versions, by resume then sequence",
    ),
  },
});

const captureVersion = createRoute({
  method: "post",
  path: versionsPath,
  tags: ["resume versions"],
  summary: "Capture what a resume says right now",
  description:
    "The manifest is captured by the store, not supplied: a version records what the resume said. Answers 200 with the current version, unchanged, when nothing has moved since it was captured.",
  request: {
    body: jsonBody(
      z.object({
        id: uuidSchema,
        resumeId: uuidSchema,
        trigger: versionTriggerSchema,
        restoredFromVersionId: uuidSchema.nullable().default(null),
      }),
    ),
  },
  responses: {
    ...sessionRequired,
    200: jsonResponse(resumeVersionSchema, "the current version, because the manifest matched it"),
    201: jsonResponse(resumeVersionSchema, "the version as stored"),
    404: problemResponse("no resume of this owner has that id"),
    409: problemResponse("the id is already taken"),
  },
});

const readVersion = createRoute({
  method: "get",
  path: `${versionsPath}/{id}`,
  tags: ["resume versions"],
  summary: "Read one version and the manifest it pinned",
  request: { params: idParam },
  responses: {
    ...sessionRequired,
    200: jsonResponse(resumeVersionSchema, "the version"),
    404: noVersion,
  },
});

const snapshots = collectionRoutes({
  path: "/v1/resume-snapshots",
  tag: "resume snapshots",
  noun: "resume snapshot",
  dto: resumeSnapshotSchema,
  input: resumeSnapshotInputSchema,
  patch: resumeSnapshotPatchSchema,
  query: archivedQuery.extend({ resumeId: uuidSchema.optional() }),
});

// Nested under what is being asked about: the answer is a list of versions, not
// a collection of its own. Generic in the path, like `collectionRoutes`: a
// `string` here collapses the whole typed client into one route.
function usageRoute<Path extends string>(path: Path, tag: string, subject: string) {
  return createRoute({
    method: "get",
    path,
    tags: [tag],
    summary: `List the versions a ${subject} is printed in`,
    request: { params: idParam },
    responses: {
      ...sessionRequired,
      200: jsonResponse(
        z.object({ items: z.array(versionRefSchema) }),
        "the versions that pinned it, oldest first",
      ),
      404: problemResponse(`no ${subject} of this owner has that id`),
    },
  });
}

const pointUsage = usageRoute("/v1/points/{id}/usage", "points", "point");
const recordUsage = usageRoute("/v1/records/{id}/usage", "records", "record");

export function versionRoutes(unitOfWork: UnitOfWork) {
  const readSnapshot = async (id: Uuid) =>
    await unitOfWork.run(async (r) => await r.versions.getSnapshot(id));

  return router()
    .openapi(listVersions, async (c) => {
      const { resumeId } = c.req.valid("query");
      const items = await unitOfWork.run(async (r) => await r.versions.list({ resumeId }));
      return c.json({ items }, 200);
    })
    .openapi(captureVersion, async (c) => {
      const input = c.req.valid("json");
      const appended = await unitOfWork.run(async (r) => {
        const manifest = captureManifest(await r.store.readCurrent(), input.resumeId);
        if (manifest === undefined) throw new NotFoundError("resume", input.resumeId);
        return await r.versions.append({ ...input, manifest });
      });
      return appended.created ? c.json(appended.version, 201) : c.json(appended.version, 200);
    })
    .openapi(readVersion, async (c) => {
      const { id } = c.req.valid("param");
      return c.json(await unitOfWork.run(async (r) => await r.versions.get(id)), 200);
    })

    .openapi(snapshots.list, async (c) => {
      const { archived, resumeId } = c.req.valid("query");
      const items = await unitOfWork.run(
        async (r) =>
          await r.versions.listSnapshots({ resumeId, includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(snapshots.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await unitOfWork.run(async (r) => await r.versions.star(input)), 201);
    })
    .openapi(snapshots.read, async (c) => {
      return c.json(await readSnapshot(c.req.valid("param").id), 200);
    })
    .openapi(snapshots.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () =>
          await unitOfWork.run(
            async (r) => await r.versions.updateSnapshot(id, patch, expectedUpdatedAt),
          ),
        async () => await readSnapshot(id),
      );
      return c.json(updated, 200);
    })
    .openapi(snapshots.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const unstarred = await mutate(
        async () =>
          await unitOfWork.run(
            async (r) => await r.versions.archiveSnapshot(id, expectedUpdatedAt),
          ),
        async () => await readSnapshot(id),
      );
      return c.json(unstarred, 200);
    })
    .openapi(snapshots.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () =>
          await unitOfWork.run(
            async (r) => await r.versions.restoreSnapshot(id, expectedUpdatedAt),
          ),
        async () => await readSnapshot(id),
      );
      return c.json(restored, 200);
    })

    .openapi(pointUsage, async (c) => {
      const { id } = c.req.valid("param");
      const items = await unitOfWork.run(async (r) => {
        await r.points.get(id);
        return await r.versions.usage("point", id);
      });
      return c.json({ items }, 200);
    })
    .openapi(recordUsage, async (c) => {
      const { id } = c.req.valid("param");
      const items = await unitOfWork.run(async (r) => {
        await r.records.get(id);
        return await r.versions.usage("record", id);
      });
      return c.json({ items }, 200);
    });
}
