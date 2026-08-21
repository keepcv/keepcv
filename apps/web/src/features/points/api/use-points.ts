import { deriveRevision, newUuid } from "@keepcv/core";
import type { Metric, MetricInput, Point, PointInput, PointPatch, Uuid } from "@keepcv/schema";
import { metricSchema, phrasingSchema, phrasingSetSchema, pointSchema } from "@keepcv/schema";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { now, useStoreMutation } from "../../../lib/store-cache.js";

function replace<T extends { id: Uuid }>(rows: readonly T[], row: T): T[] {
  return rows.map((existing) => (existing.id === row.id ? row : existing));
}

export interface CreatePoint {
  point: PointInput;
}

export function useCreatePoint(client: ApiClient) {
  return useStoreMutation<CreatePoint, Point>({
    send: async ({ point }) =>
      pointSchema.parse(await unwrap(await client.v1.points.$post({ json: point }))),
    optimistic: (store, { point }) => {
      const at = now();
      const standard = { createdAt: at, updatedAt: at, archivedAt: null };
      const revisionId = newUuid();
      const { phrasing, ...columns } = point;

      return {
        ...store,
        phrasingSets: [
          ...store.phrasingSets,
          phrasingSetSchema.parse({
            ...standard,
            id: point.phrasingSetId,
            purpose: "point",
            canonicalPhrasingId: phrasing.id,
          }),
        ],
        phrasings: [
          ...store.phrasings,
          phrasingSchema.parse({
            ...standard,
            ...phrasing,
            phrasingSetId: point.phrasingSetId,
            currentRevisionId: revisionId,
          }),
        ],
        // The store mints the real revision id, since a content hash is what
        // makes an append idempotent. This one lives until the re-read.
        phrasingRevisions: [
          ...store.phrasingRevisions,
          {
            id: revisionId,
            createdAt: at,
            phrasingId: phrasing.id,
            ...deriveRevision(phrasing.body),
          },
        ],
        points: [...store.points, pointSchema.parse({ ...standard, ...columns })],
      };
    },
  });
}

export interface UpdatePoint {
  point: Point;
  patch: PointPatch;
}

// No text here: what a point says is the phrasing editor's to append
// (application-structure.md #5.4).
export function useUpdatePoint(client: ApiClient) {
  return useStoreMutation<UpdatePoint, Point>({
    send: async ({ point, patch }) =>
      pointSchema.parse(
        await unwrap(
          await client.v1.points[":id"].$patch({
            param: { id: point.id },
            json: { expectedUpdatedAt: point.updatedAt, patch },
          }),
        ),
      ),
    optimistic: (store, { point, patch }) => ({
      ...store,
      points: replace(store.points, pointSchema.parse({ ...point, ...patch, updatedAt: now() })),
    }),
  });
}

export interface SetPointArchived {
  point: Point;
  archived: boolean;
}

export function useSetPointArchived(client: ApiClient) {
  return useStoreMutation<SetPointArchived, Point>({
    send: async ({ point, archived }) => {
      const param = { id: point.id };
      const json = { expectedUpdatedAt: point.updatedAt };
      const response = archived
        ? await client.v1.points[":id"].$delete({ param, json })
        : await client.v1.points[":id"].restore.$post({ param, json });
      return pointSchema.parse(await unwrap(response));
    },
    optimistic: (store, { point, archived }) => ({
      ...store,
      points: replace(store.points, {
        ...point,
        archivedAt: archived ? now() : null,
        updatedAt: now(),
      }),
    }),
  });
}

export function useAddMetric(client: ApiClient) {
  return useStoreMutation<MetricInput, Metric>({
    send: async (metric) =>
      metricSchema.parse(await unwrap(await client.v1.metrics.$post({ json: metric }))),
    optimistic: (store, metric) => {
      const at = now();
      return {
        ...store,
        metrics: [
          ...store.metrics,
          metricSchema.parse({ ...metric, createdAt: at, updatedAt: at, archivedAt: null }),
        ],
      };
    },
  });
}

// Archived, not deleted: a number that turned out wrong is still what a resume
// printed last March.
export function useArchiveMetric(client: ApiClient) {
  return useStoreMutation<Metric, Metric>({
    send: async (metric) =>
      metricSchema.parse(
        await unwrap(
          await client.v1.metrics[":id"].$delete({
            param: { id: metric.id },
            json: { expectedUpdatedAt: metric.updatedAt },
          }),
        ),
      ),
    optimistic: (store, metric) => ({
      ...store,
      metrics: replace(store.metrics, { ...metric, archivedAt: now(), updatedAt: now() }),
    }),
  });
}
