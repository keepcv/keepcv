import { search, textOfPoint } from "@keepcv/core";
import type { CareerRecordKind, Store, Uuid } from "@keepcv/schema";

export interface SearchRow {
  key: string;
  subject: "record" | "point";
  // A point is opened through the record it prints under, so both rows link to
  // a record; a point with no record is captured and not yet placed.
  recordId: Uuid | null;
  title: string;
  context: string;
  kind: CareerRecordKind | null;
  isArchived: boolean;
}

export interface SearchFilters {
  q: string;
  archived: boolean;
}

export function searchRows(store: Store, filters: SearchFilters): SearchRow[] {
  return search(store, filters.q, { includeArchived: filters.archived }).flatMap<SearchRow>(
    (hit) => {
      if (hit.subject === "record") {
        const record = store.records.find((row) => row.id === hit.id);
        if (record === undefined) return [];
        const organisation = store.organisations.find((row) => row.id === record.organisationId);
        return [
          {
            key: `record:${hit.id}`,
            subject: hit.subject,
            recordId: record.id,
            title: record.title ?? "Untitled",
            context: [organisation?.name, record.subtitle].filter(Boolean).join(" - "),
            kind: record.kind,
            isArchived: record.archivedAt !== null,
          },
        ];
      }

      const point = store.points.find((row) => row.id === hit.id);
      if (point === undefined) return [];
      const parent = store.records.find((row) => row.id === point.recordId);
      return [
        {
          key: `point:${hit.id}`,
          subject: hit.subject,
          recordId: point.recordId,
          title: textOfPoint(store, point) || "an empty point",
          context: parent?.title ?? "not on a record yet",
          kind: parent?.kind ?? null,
          isArchived: point.archivedAt !== null,
        },
      ];
    },
  );
}
