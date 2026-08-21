import { createRoute } from "@hono/zod-openapi";
import {
  captureManifest,
  diffManifests,
  manifestRefs,
  NotFoundError,
  type Repositories,
  type RestoreChange,
  type RestorePlan,
  restorePlan,
  type UnitOfWork,
} from "@keepcv/core";
import {
  manifestDiffSchema,
  type PhrasingRevision,
  type ResumeManifest,
  restoredResumeSchema,
  resumeSnapshotInputSchema,
  resumeSnapshotPatchSchema,
  resumeSnapshotSchema,
  resumeVersionSchema,
  type Timestamp,
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

// Declared before the parameterised route below: `diff` is a screen, not an id.
const diffVersions = createRoute({
  method: "get",
  path: `${versionsPath}/diff`,
  tags: ["resume versions"],
  summary: "Compare what two versions say",
  description:
    "Only what differs, with the pinned wordings resolved, so nothing has to be fetched to read the answer.",
  request: { query: z.object({ a: uuidSchema, b: uuidSchema }) },
  responses: {
    ...sessionRequired,
    200: jsonResponse(manifestDiffSchema, "the changes, with `b` as the newer side"),
    404: noVersion,
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

const restoreVersion = createRoute({
  method: "post",
  path: `${versionsPath}/{id}/restore`,
  tags: ["resume versions"],
  summary: "Put a version's selection back over the working composition",
  description:
    "Never rewinds: the older selection is written back and a new version records that it happened. Records and wordings are untouched, because a version pins the selection rather than the words. The id in the body is the version this appends; the one in the path is the version it comes from.",
  request: { params: idParam, body: jsonBody(z.object({ id: uuidSchema })) },
  responses: {
    ...sessionRequired,
    201: jsonResponse(restoredResumeSchema, "the version it appended, and what it could not place"),
    404: noVersion,
    409: problemResponse("the composition changed while this was being applied"),
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

// The manifests pin text by reference, so both sides of a diff and every
// selection a restore puts back need the revisions they name.
async function revisionsFor(
  repositories: Repositories,
  manifests: readonly ResumeManifest[],
): Promise<PhrasingRevision[]> {
  const ids = manifests.flatMap((manifest) =>
    manifestRefs(manifest)
      .filter((ref) => ref.refKind === "phrasing_revision")
      .map((ref) => ref.refId),
  );
  return await repositories.phrasings.listRevisions({ ids });
}

async function applyChange<Row extends { updatedAt: Timestamp }, Patch extends object>(
  change: RestoreChange<Patch>,
  unarchive: (id: Uuid, token: Timestamp) => Promise<Row>,
  update: (id: Uuid, patch: Patch, token: Timestamp) => Promise<Row>,
): Promise<void> {
  const token = change.unarchive
    ? (await unarchive(change.id, change.expectedUpdatedAt)).updatedAt
    : change.expectedUpdatedAt;
  if (Object.keys(change.patch).length > 0) await update(change.id, change.patch, token);
}

// In order: a section exists before an entry names it, and an entry before the
// points under it.
async function applyPlan(repositories: Repositories, plan: RestorePlan): Promise<void> {
  const resumes = repositories.resumes;
  if (plan.resume !== null) {
    await resumes.update(plan.resume.id, plan.resume.patch, plan.resume.expectedUpdatedAt);
  }

  for (const input of plan.addSections) await resumes.addSection(input);
  for (const change of plan.sections) {
    await applyChange(
      change,
      async (id, token) => await resumes.restoreSection(id, token),
      async (id, patch, token) => await resumes.updateSection(id, patch, token),
    );
  }

  for (const input of plan.addEntries) await resumes.addEntry(input);
  for (const change of plan.entries) {
    await applyChange(
      change,
      async (id, token) => await resumes.restoreEntry(id, token),
      async (id, patch, token) => await resumes.updateEntry(id, patch, token),
    );
  }

  for (const input of plan.addEntryPoints) await resumes.addEntryPoint(input);
  for (const change of plan.entryPoints) {
    await applyChange(
      change,
      async (id, token) => await resumes.restoreEntryPoint(id, token),
      async (id, patch, token) => await resumes.updateEntryPoint(id, patch, token),
    );
  }

  for (const row of plan.contacts) {
    await resumes.setContactChannel(row.resumeId, row.contactChannelId, row.isVisible);
  }
  for (const id of plan.revertedContacts) await resumes.clearContactChannel(plan.resumeId, id);
}

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
    .openapi(diffVersions, async (c) => {
      const { a, b } = c.req.valid("query");
      const diff = await unitOfWork.run(async (r) => {
        const left = await r.versions.get(a);
        const right = await r.versions.get(b);
        const revisions = await revisionsFor(r, [left.manifest, right.manifest]);
        return diffManifests(left.manifest, right.manifest, revisions);
      });
      return c.json(diff, 200);
    })
    .openapi(readVersion, async (c) => {
      const { id } = c.req.valid("param");
      return c.json(await unitOfWork.run(async (r) => await r.versions.get(id)), 200);
    })
    .openapi(restoreVersion, async (c) => {
      const { id } = c.req.valid("param");
      const { id: appendedId } = c.req.valid("json");

      const restored = await unitOfWork.run(async (r) => {
        const version = await r.versions.get(id);
        const revisions = await revisionsFor(r, [version.manifest]);
        const plan = restorePlan(
          await r.store.readCurrent(),
          version.resumeId,
          version.manifest,
          revisions,
        );
        if (plan === undefined) throw new NotFoundError("resume", version.resumeId);
        await applyPlan(r, plan);

        // Captured again rather than copied: what the timeline records is what
        // the resume says now, which is the manifest minus whatever it omitted.
        const manifest = captureManifest(await r.store.readCurrent(), version.resumeId);
        if (manifest === undefined) throw new NotFoundError("resume", version.resumeId);
        const appended = await r.versions.append({
          id: appendedId,
          resumeId: version.resumeId,
          trigger: "restore",
          restoredFromVersionId: version.id,
          manifest,
        });
        return { version: appended.version, omissions: plan.omissions };
      });

      return c.json(restored, 201);
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
