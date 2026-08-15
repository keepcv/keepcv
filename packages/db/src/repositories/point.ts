import {
  DuplicatePointRecordLinkError,
  type PhrasingRepository,
  type PointRepository,
} from "@keepcv/core";
import {
  type Evidence,
  evidenceSchema,
  type Metric,
  metricSchema,
  type Point,
  pointRecordLinkSchema,
  pointSchema,
  type Timestamp,
  type Uuid,
} from "@keepcv/schema";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import { evidence, metric, point, pointRecordLink } from "../schema/index.js";
import {
  type Changes,
  insertOwned,
  live,
  owned,
  requireOwned,
  standardDto,
  updateOwned,
} from "./owned-row.js";

type PointRow = typeof point.$inferSelect;
type MetricRow = typeof metric.$inferSelect;
type EvidenceRow = typeof evidence.$inferSelect;

function toPoint(row: PointRow): Point {
  return pointSchema.parse({
    ...standardDto(row),
    recordId: row.recordId,
    phrasingSetId: row.phrasingSetId,
    confidence: row.confidence,
    occurredOn: row.occurredOn,
    sortKey: row.sortKey,
  });
}

function toMetric(row: MetricRow): Metric {
  return metricSchema.parse({
    ...standardDto(row),
    pointId: row.pointId,
    label: row.label,
    value: row.value,
    unit: row.unit,
    baseline: row.baseline,
    direction: row.direction,
    period: row.period,
    sortKey: row.sortKey,
  });
}

function toEvidence(row: EvidenceRow): Evidence {
  return evidenceSchema.parse({
    ...standardDto(row),
    pointId: row.pointId,
    kind: row.kind,
    value: row.value,
    note: row.note,
  });
}

export function createPointRepository(
  db: Database,
  phrasings: PhrasingRepository,
): PointRepository {
  async function setPoint(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<PointRow>,
  ): Promise<Point> {
    return toPoint(await updateOwned<PointRow>(db, point, "point", id, expectedUpdatedAt, changes));
  }

  async function setMetric(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<MetricRow>,
  ): Promise<Metric> {
    return toMetric(
      await updateOwned<MetricRow>(db, metric, "metric", id, expectedUpdatedAt, changes),
    );
  }

  async function setEvidence(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<EvidenceRow>,
  ): Promise<Evidence> {
    return toEvidence(
      await updateOwned<EvidenceRow>(db, evidence, "evidence", id, expectedUpdatedAt, changes),
    );
  }

  async function dropLink(pointId: Uuid, recordId: Uuid): Promise<void> {
    await db
      .delete(pointRecordLink)
      .where(
        and(
          eq(pointRecordLink.ownerId, currentOwnerId()),
          eq(pointRecordLink.pointId, pointId),
          eq(pointRecordLink.recordId, recordId),
        ),
      );
  }

  return {
    // Sort keys are unique per record, so a cross-record list orders by record
    // first. The points nobody has placed sort last, which is where the inbox
    // that shows them belongs.
    async list(options) {
      const rows = await db
        .select()
        .from(point)
        .where(
          and(
            owned(point),
            options?.recordId === undefined ? undefined : eq(point.recordId, options.recordId),
            live(point, options?.includeArchived),
          ),
        )
        .orderBy(asc(point.recordId), asc(point.sortKey));
      return rows.map(toPoint);
    },

    async get(id) {
      return toPoint(await requireOwned<PointRow>(db, point, "point", id));
    },

    // The phrasing set first, because the point references it. Five tables in
    // one transaction, which is the reason there is no non-transactional path to
    // a repository.
    async create(input) {
      const { phrasing, ...columns } = input;
      await phrasings.createSet({ id: input.phrasingSetId, purpose: "point", phrasing });

      return toPoint(await insertOwned(db, point, "point", columns));
    },

    // Making a linked record the primary one drops the link: the primary already
    // says the point relates to that record, and keeping both would be the same
    // relationship written twice.
    async update(id, patch, expectedUpdatedAt) {
      if (patch.recordId != null) {
        await dropLink(id, patch.recordId);
      }
      return await setPoint(id, expectedUpdatedAt, patch);
    },

    async archive(id, expectedUpdatedAt) {
      return await setPoint(id, expectedUpdatedAt, { archivedAt: new Date() });
    },

    async restore(id, expectedUpdatedAt) {
      return await setPoint(id, expectedUpdatedAt, { archivedAt: null });
    },

    async listRecordLinks(options) {
      const rows = await db
        .select()
        .from(pointRecordLink)
        .where(
          and(
            eq(pointRecordLink.ownerId, currentOwnerId()),
            options?.pointId === undefined
              ? undefined
              : eq(pointRecordLink.pointId, options.pointId),
          ),
        )
        .orderBy(asc(pointRecordLink.pointId), asc(pointRecordLink.recordId));
      return rows.map((row) => pointRecordLinkSchema.parse(row));
    },

    // Idempotent, because the pair is the whole row: linking twice leaves
    // nothing to change.
    async linkRecord(pointId, recordId) {
      const current = await requireOwned<PointRow>(db, point, "point", pointId);
      if (current.recordId === recordId) {
        throw new DuplicatePointRecordLinkError(pointId, recordId);
      }

      await db
        .insert(pointRecordLink)
        .values({ ownerId: currentOwnerId(), pointId, recordId })
        .onConflictDoNothing();
      return pointRecordLinkSchema.parse({ pointId, recordId });
    },

    // Unlinking a record that was never linked has already achieved what the
    // caller asked for, so only the point has to exist.
    async unlinkRecord(pointId, recordId) {
      await requireOwned<PointRow>(db, point, "point", pointId);
      await dropLink(pointId, recordId);
    },

    async listMetrics(options) {
      const rows = await db
        .select()
        .from(metric)
        .where(
          and(
            owned(metric),
            options?.pointId === undefined ? undefined : eq(metric.pointId, options.pointId),
            live(metric, options?.includeArchived),
          ),
        )
        .orderBy(asc(metric.pointId), asc(metric.sortKey));
      return rows.map(toMetric);
    },

    async createMetric(input) {
      return toMetric(await insertOwned(db, metric, "metric", input));
    },

    async updateMetric(id, patch, expectedUpdatedAt) {
      return await setMetric(id, expectedUpdatedAt, patch);
    },

    async archiveMetric(id, expectedUpdatedAt) {
      return await setMetric(id, expectedUpdatedAt, { archivedAt: new Date() });
    },

    async restoreMetric(id, expectedUpdatedAt) {
      return await setMetric(id, expectedUpdatedAt, { archivedAt: null });
    },

    // Evidence has no sort key, so the id carries the order and two reads of it
    // are the same list.
    async listEvidence(options) {
      const rows = await db
        .select()
        .from(evidence)
        .where(
          and(
            owned(evidence),
            options?.pointId === undefined ? undefined : eq(evidence.pointId, options.pointId),
            live(evidence, options?.includeArchived),
          ),
        )
        .orderBy(asc(evidence.pointId), asc(evidence.id));
      return rows.map(toEvidence);
    },

    async createEvidence(input) {
      return toEvidence(await insertOwned(db, evidence, "evidence", input));
    },

    async updateEvidence(id, patch, expectedUpdatedAt) {
      return await setEvidence(id, expectedUpdatedAt, patch);
    },

    async archiveEvidence(id, expectedUpdatedAt) {
      return await setEvidence(id, expectedUpdatedAt, { archivedAt: new Date() });
    },

    async restoreEvidence(id, expectedUpdatedAt) {
      return await setEvidence(id, expectedUpdatedAt, { archivedAt: null });
    },
  };
}
