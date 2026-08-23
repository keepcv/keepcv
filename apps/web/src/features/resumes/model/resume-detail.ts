import {
  canonicalPhrasingOf,
  compile,
  composition,
  live,
  organisationOf,
  type PlaceableSection,
  phrasingsOfSet,
  placeablePoints,
  placeableRecords,
  placeableSections,
  pointsOfRecord,
  sectionHeading,
  textOfPhrasing,
  textOfPoint,
} from "@keepcv/core";
import type {
  ContactChannel,
  Resume,
  ResumeDocument,
  ResumeEntry,
  ResumeEntryPoint,
  ResumeSection,
  Store,
  Uuid,
} from "@keepcv/schema";
import { formatPeriod } from "../../records/model/record-rows.js";
import { type ResumeRow, toResumeRow } from "./resume-rows.js";

export interface Choice {
  id: Uuid;
  label: string;
}

// The wording a point takes when it is placed: an entry point pins a phrasing
// rather than a set, so there is nothing to resolve later.
export interface PlaceablePoint extends Choice {
  phrasingId: Uuid;
}

export interface CompositionPoint {
  row: ResumeEntryPoint;
  pointId: Uuid;
  text: string;
  isVisible: boolean;
  isArchived: boolean;
  wordings: Choice[];
}

export interface CompositionEntry {
  row: ResumeEntry;
  recordId: Uuid;
  title: string;
  organisation: string | null;
  period: string | null;
  isVisible: boolean;
  isArchived: boolean;
  points: CompositionPoint[];
  // What the record could have contributed: a skill with none says nothing, and
  // a job with six and none chosen is worth saying out loud.
  available: number;
  placeable: PlaceablePoint[];
}

export interface CompositionSection {
  row: ResumeSection;
  heading: string;
  // A section printing its kind's default, so renaming starts from what is on
  // the page rather than from an empty box.
  isDefaultHeading: boolean;
  isVisible: boolean;
  entries: CompositionEntry[];
  placeable: Choice[];
}

export interface ContactRow {
  channel: ContactChannel;
  label: string;
  prints: boolean;
  isOverridden: boolean;
}

export interface ResumeDetail {
  resume: Resume;
  header: ResumeRow;
  sections: CompositionSection[];
  addable: PlaceableSection[];
  contacts: ContactRow[];
  document: ResumeDocument | undefined;
}

// The pinned one is offered even when it has been put away, or the select would
// show a wording this resume is not printing.
function wordingsOf(store: Store, phrasingSetId: Uuid | null, pinned: Uuid): Choice[] {
  if (phrasingSetId === null) return [];
  return phrasingsOfSet(store, phrasingSetId)
    .filter((phrasing) => phrasing.archivedAt === null || phrasing.id === pinned)
    .map((phrasing) => ({
      id: phrasing.id,
      label: phrasing.label ?? textOfPhrasing(store, phrasing) ?? phrasing.variant,
    }));
}

function contactsOf(store: Store, resumeId: Uuid): ContactRow[] {
  const overrides = new Map(
    store.resumeContactChannels
      .filter((row) => row.resumeId === resumeId)
      .map((row) => [row.contactChannelId, row.isVisible]),
  );
  return live(store.contactChannels).map((channel) => ({
    channel,
    label: channel.label ?? channel.kind,
    prints: overrides.get(channel.id) ?? channel.isDefaultVisible,
    isOverridden: overrides.has(channel.id),
  }));
}

export function resumeDetail(store: Store, resumeId: Uuid, asOf: string): ResumeDetail | undefined {
  const composed = composition(store, resumeId);
  if (composed === undefined) return undefined;

  return {
    resume: composed.resume,
    header: toResumeRow(store, composed.resume),
    addable: placeableSections(store, resumeId),
    contacts: contactsOf(store, resumeId),
    sections: composed.sections.map((section) => ({
      row: section.section,
      heading: sectionHeading(store, section.section),
      isDefaultHeading: section.section.heading === null,
      isVisible: section.section.isVisible,
      placeable: placeableRecords(store, section.section.id).map((record) => ({
        id: record.id,
        label: record.title ?? "Untitled",
      })),
      entries: section.entries.map((entry) => ({
        row: entry.entry,
        recordId: entry.record.id,
        title: entry.record.title ?? "Untitled",
        organisation: organisationOf(store, entry.record)?.name ?? null,
        period: formatPeriod(entry.record),
        isVisible: entry.entry.isVisible,
        isArchived: entry.record.archivedAt !== null,
        available: live(pointsOfRecord(store, entry.record.id)).length,
        placeable: placeablePoints(store, resumeId, entry.entry.id).flatMap((point) => {
          const phrasing = canonicalPhrasingOf(store, point.phrasingSetId);
          return phrasing === undefined
            ? []
            : [
                {
                  id: point.id,
                  label: textOfPoint(store, point) || "an empty point",
                  phrasingId: phrasing.id,
                },
              ];
        }),
        points: entry.points.map((point) => ({
          row: point.entryPoint,
          pointId: point.point.id,
          text: textOfPhrasing(store, point.phrasing),
          isVisible: point.entryPoint.isVisible,
          isArchived: point.point.archivedAt !== null,
          wordings: wordingsOf(store, point.point.phrasingSetId, point.entryPoint.phrasingId),
        })),
      })),
    })),
    document: compile(store, resumeId, { generatedAt: asOf }),
  };
}
