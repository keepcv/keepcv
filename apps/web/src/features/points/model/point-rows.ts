import { formatMetric, live, pointsWithTag, tagsOfPoint, textOfPoint } from "@keepcv/core";
import type { PointConfidence, Store, Uuid } from "@keepcv/schema";

export const POINT_FILTERS = ["all", "unplaced", "unmeasured", "archived"] as const;

export type PointFilter = (typeof POINT_FILTERS)[number];

export const POINT_FILTER_LABELS: Record<PointFilter, string> = {
  all: "All",
  unplaced: "Unplaced",
  unmeasured: "No metric",
  archived: "Archived",
};

export interface PointListRow {
  id: Uuid;
  text: string;
  recordId: Uuid | null;
  recordTitle: string | null;
  metrics: string[];
  tags: string[];
  confidence: PointConfidence;
  // How many resumes print it, which is the answer to "is this worth keeping".
  placements: number;
  isArchived: boolean;
}

export interface PointFilters {
  filter: PointFilter;
  tagId?: Uuid | undefined;
}

export function pointRows(store: Store, { filter, tagId }: PointFilters): PointListRow[] {
  const measured = new Set(live(store.metrics).map((metric) => metric.pointId));
  const carrying =
    tagId === undefined ? undefined : new Set(pointsWithTag(store, tagId).map((point) => point.id));

  return store.points
    .filter((point) =>
      filter === "archived" ? point.archivedAt !== null : point.archivedAt === null,
    )
    .filter((point) => carrying === undefined || carrying.has(point.id))
    .filter((point) => filter !== "unplaced" || point.recordId === null)
    .filter((point) => filter !== "unmeasured" || !measured.has(point.id))
    .map((point) => ({
      id: point.id,
      text: textOfPoint(store, point),
      recordId: point.recordId,
      recordTitle: store.records.find((record) => record.id === point.recordId)?.title ?? null,
      metrics: live(store.metrics)
        .filter((metric) => metric.pointId === point.id)
        .map((metric) => `${metric.label} ${formatMetric(metric, metric.id).display}`),
      tags: tagsOfPoint(store, point.id).map((tag) => tag.label),
      confidence: point.confidence,
      placements: new Set(
        live(store.resumeEntryPoints)
          .filter((row) => row.pointId === point.id && row.isVisible)
          .map((row) => row.resumeId),
      ).size,
      isArchived: point.archivedAt !== null,
    }));
}
