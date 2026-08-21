import {
  bySortKey,
  formatMetric,
  live,
  pointsOfRecord,
  tagsOfPoint,
  tagsOfRecord,
  textOfPhrasingSet,
  textOfPoint,
} from "@keepcv/core";
import type {
  CareerRecord,
  PointConfidence,
  RecordField,
  RecordLink,
  Store,
  Uuid,
} from "@keepcv/schema";
import { type RecordRow, toRecordRow } from "./record-rows.js";

export interface PointRow {
  id: Uuid;
  text: string;
  metrics: string[];
  tags: string[];
  confidence: PointConfidence;
  isArchived: boolean;
  // A point can print under a record it is not filed under (data-model.md #7).
  isSecondary: boolean;
}

export interface Placement {
  resumeId: Uuid;
  resumeName: string;
  isVisible: boolean;
}

export interface RecordDetail {
  record: CareerRecord;
  row: RecordRow;
  summary: string;
  points: PointRow[];
  links: RecordLink[];
  fields: RecordField[];
  tags: string[];
  placements: Placement[];
}

function pointRows(store: Store, recordId: Uuid): PointRow[] {
  return pointsOfRecord(store, recordId).map((point) => ({
    id: point.id,
    text: textOfPoint(store, point),
    metrics: live(store.metrics)
      .filter((metric) => metric.pointId === point.id)
      .map((metric) => `${metric.label} ${formatMetric(metric, metric.id).display}`),
    tags: tagsOfPoint(store, point.id).map((tag) => tag.label),
    confidence: point.confidence,
    isArchived: point.archivedAt !== null,
    isSecondary: point.recordId !== recordId,
  }));
}

// Every resume this record sits on, whether or not it prints there: "toggled
// off" is a state the composer has to be able to show.
function placements(store: Store, recordId: Uuid): Placement[] {
  return live(store.resumeEntries)
    .filter((entry) => entry.recordId === recordId)
    .flatMap((entry) => {
      const resume = store.resumes.find((row) => row.id === entry.resumeId);
      return resume === undefined
        ? []
        : [{ resumeId: resume.id, resumeName: resume.name, isVisible: entry.isVisible }];
    });
}

export function recordDetail(store: Store, recordId: Uuid): RecordDetail | undefined {
  const record = store.records.find((entry) => entry.id === recordId);
  if (record === undefined) return undefined;

  const inOrder = <T extends { sortKey: string; id: Uuid }>(rows: T[]): T[] =>
    [...rows].sort(bySortKey);

  return {
    record,
    row: toRecordRow(store, record),
    summary: textOfPhrasingSet(store, record.summarySetId),
    points: pointRows(store, recordId),
    links: inOrder(live(store.recordLinks).filter((row) => row.recordId === recordId)),
    fields: inOrder(live(store.recordFields).filter((row) => row.recordId === recordId)),
    tags: tagsOfRecord(store, recordId).map((tag) => tag.label),
    placements: placements(store, recordId),
  };
}
