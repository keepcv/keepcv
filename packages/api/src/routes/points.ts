import { createRoute } from "@hono/zod-openapi";
import type { PointRepository, UnitOfWork } from "@keepcv/core";
import {
  evidenceInputSchema,
  evidencePatchSchema,
  evidenceSchema,
  metricInputSchema,
  metricPatchSchema,
  metricSchema,
  pointConfidenceSchema,
  pointInputSchema,
  pointPatchSchema,
  pointRecordLinkSchema,
  pointSchema,
  type Uuid,
  uuidSchema,
} from "@keepcv/schema";
import { z } from "zod";
import { mutate } from "../problems.js";
import { jsonResponse, problemResponse, router, sessionRequired } from "../router.js";
import { archivedQuery, collectionRoutes } from "./collection.js";

const points = collectionRoutes({
  path: "/v1/points",
  tag: "points",
  noun: "point",
  dto: pointSchema,
  input: pointInputSchema,
  patch: pointPatchSchema,
  query: archivedQuery.extend({
    recordId: uuidSchema.optional(),
    confidence: pointConfidenceSchema.optional(),
    tag: uuidSchema.optional(),
  }),
});

// Flat and narrowed by `?pointId`, for the reason links and fields are
// (api-contract.md #3): the store keys one by its own id alone.
const byPoint = archivedQuery.extend({ pointId: uuidSchema.optional() });

const metrics = collectionRoutes({
  path: "/v1/metrics",
  tag: "metrics",
  noun: "metric",
  dto: metricSchema,
  input: metricInputSchema,
  patch: metricPatchSchema,
  query: byPoint,
});

// "Evidence" has no singular, and "Add a evidence" is what templating the noun
// alone would produce.
const evidence = collectionRoutes({
  path: "/v1/evidence",
  tag: "evidence",
  noun: "evidence item",
  dto: evidenceSchema,
  input: evidenceInputSchema,
  patch: evidencePatchSchema,
  query: byPoint,
});

const pairParams = z.object({ id: uuidSchema, recordId: uuidSchema });
const pointParam = z.object({ id: uuidSchema });
const noPoint = problemResponse("no point of this owner has that id");

// A point's secondary parents. `Point.recordId` decides where it prints; these
// say it also relates to a record, which is what discovery and selection read.
const listRecords = createRoute({
  method: "get",
  path: "/v1/points/{id}/records",
  tags: ["points"],
  summary: "List the records a point also relates to",
  request: { params: pointParam },
  responses: {
    ...sessionRequired,
    200: jsonResponse(
      z.object({ items: z.array(pointRecordLinkSchema) }),
      "the point's secondary records, not counting the one it prints under",
    ),
    404: noPoint,
  },
});

// No body and no token: the pair is the whole row, so a repeat has nothing to
// change and there is nothing for a concurrent edit to race.
const linkRecord = createRoute({
  method: "put",
  path: "/v1/points/{id}/records/{recordId}",
  tags: ["points"],
  summary: "Relate a point to another record",
  description: "Idempotent. Repeating it answers with the link that is already there.",
  request: { params: pairParams },
  responses: {
    ...sessionRequired,
    200: jsonResponse(pointRecordLinkSchema, "the link, whether it was just made or already there"),
    404: noPoint,
    409: problemResponse(
      "the point already prints under that record, so the link would say nothing",
    ),
  },
});

const unlinkRecord = createRoute({
  method: "delete",
  path: "/v1/points/{id}/records/{recordId}",
  tags: ["points"],
  summary: "Stop relating a point to a record",
  description:
    "A link holds nothing of its own, so removing one destroys nothing and both ends survive. Unlinking a pair that was never linked is the same answer.",
  request: { params: pairParams },
  responses: { ...sessionRequired, 204: { description: "the pair is not linked" }, 404: noPoint },
});

export function pointRoutes(unitOfWork: UnitOfWork) {
  const on = async <T>(work: (of: PointRepository) => Promise<T>): Promise<T> =>
    await unitOfWork.run(async (r) => await work(r.points));

  const readPoint = async (id: Uuid) => await on(async (of) => await of.get(id));
  const readMetric = async (id: Uuid) => await on(async (of) => await of.getMetric(id));
  const readEvidence = async (id: Uuid) => await on(async (of) => await of.getEvidence(id));

  return router()
    .openapi(points.list, async (c) => {
      const { archived, recordId, confidence, tag } = c.req.valid("query");
      const items = await on(
        async (of) =>
          await of.list({
            recordId,
            confidence,
            tagId: tag,
            includeArchived: archived === "include",
          }),
      );
      return c.json({ items }, 200);
    })
    .openapi(points.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.create(input)), 201);
    })
    .openapi(points.read, async (c) => {
      return c.json(await readPoint(c.req.valid("param").id), 200);
    })
    .openapi(points.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.update(id, patch, expectedUpdatedAt)),
        async () => await readPoint(id),
      );
      return c.json(updated, 200);
    })
    .openapi(points.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archive(id, expectedUpdatedAt)),
        async () => await readPoint(id),
      );
      return c.json(archived, 200);
    })
    .openapi(points.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restore(id, expectedUpdatedAt)),
        async () => await readPoint(id),
      );
      return c.json(restored, 200);
    })

    .openapi(listRecords, async (c) => {
      const { id } = c.req.valid("param");
      const items = await on(async (of) => {
        await of.get(id);
        return await of.listRecordLinks({ pointId: id });
      });
      return c.json({ items }, 200);
    })
    .openapi(linkRecord, async (c) => {
      const { id, recordId } = c.req.valid("param");
      return c.json(await on(async (of) => await of.linkRecord(id, recordId)), 200);
    })
    .openapi(unlinkRecord, async (c) => {
      const { id, recordId } = c.req.valid("param");
      await on(async (of) => {
        await of.unlinkRecord(id, recordId);
      });
      return c.body(null, 204);
    })

    .openapi(metrics.list, async (c) => {
      const { archived, pointId } = c.req.valid("query");
      const items = await on(
        async (of) => await of.listMetrics({ pointId, includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(metrics.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.createMetric(input)), 201);
    })
    .openapi(metrics.read, async (c) => {
      return c.json(await readMetric(c.req.valid("param").id), 200);
    })
    .openapi(metrics.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.updateMetric(id, patch, expectedUpdatedAt)),
        async () => await readMetric(id),
      );
      return c.json(updated, 200);
    })
    .openapi(metrics.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archiveMetric(id, expectedUpdatedAt)),
        async () => await readMetric(id),
      );
      return c.json(archived, 200);
    })
    .openapi(metrics.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restoreMetric(id, expectedUpdatedAt)),
        async () => await readMetric(id),
      );
      return c.json(restored, 200);
    })

    .openapi(evidence.list, async (c) => {
      const { archived, pointId } = c.req.valid("query");
      const items = await on(
        async (of) => await of.listEvidence({ pointId, includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(evidence.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.createEvidence(input)), 201);
    })
    .openapi(evidence.read, async (c) => {
      return c.json(await readEvidence(c.req.valid("param").id), 200);
    })
    .openapi(evidence.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.updateEvidence(id, patch, expectedUpdatedAt)),
        async () => await readEvidence(id),
      );
      return c.json(updated, 200);
    })
    .openapi(evidence.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archiveEvidence(id, expectedUpdatedAt)),
        async () => await readEvidence(id),
      );
      return c.json(archived, 200);
    })
    .openapi(evidence.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restoreEvidence(id, expectedUpdatedAt)),
        async () => await readEvidence(id),
      );
      return c.json(restored, 200);
    });
}
