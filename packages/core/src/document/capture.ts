import type {
  CareerRecord,
  ContactChannel,
  ContentRefKind,
  ManifestEntry,
  ManifestPoint,
  ManifestSection,
  Organisation,
  Phrasing,
  ResumeManifest,
  Store,
  Uuid,
} from "@keepcv/schema";
import { MANIFEST_SCHEMA_VERSION, resumeManifestSchema } from "@keepcv/schema";
import { type ComposedEntry, composition, live, sectionHeading } from "../store/selectors.js";

function inOrder<T extends { sortKey: string; id: Uuid }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id));
}

function revisionOf(store: Store, phrasing: Phrasing | undefined): Uuid | null {
  const found = store.phrasingRevisions.find((row) => row.id === phrasing?.currentRevisionId);
  return found?.id ?? null;
}

function summaryOf(store: Store, setId: Uuid | null): Uuid | null {
  if (setId === null) return null;
  const set = store.phrasingSets.find((row) => row.id === setId);
  const phrasing = store.phrasings.find((row) => row.id === set?.canonicalPhrasingId);
  return revisionOf(store, phrasing);
}

function tagLabels(store: Store, ids: readonly Uuid[]): string[] {
  const labels = ids.flatMap((id) => {
    const tag = store.tags.find((row) => row.id === id && row.archivedAt === null);
    return tag === undefined ? [] : [tag.label];
  });
  return labels.sort((a, b) => a.localeCompare(b));
}

function organisationOf(store: Store, id: Uuid | null): Organisation | null {
  return id === null ? null : (store.organisations.find((row) => row.id === id) ?? null);
}

function pointsOf(store: Store, entry: ComposedEntry): ManifestPoint[] {
  return entry.points
    .filter((placed) => placed.entryPoint.isVisible && placed.point.archivedAt === null)
    .flatMap((placed) => {
      const phrasingRevisionId = revisionOf(store, placed.phrasing);
      if (phrasingRevisionId === null) return [];
      return [
        {
          pointId: placed.point.id,
          phrasingRevisionId,
          metrics: inOrder(live(store.metrics).filter((row) => row.pointId === placed.point.id)),
          tags: tagLabels(
            store,
            store.pointTags
              .filter((row) => row.pointId === placed.point.id)
              .map((row) => row.tagId),
          ),
        },
      ];
    });
}

function entryOf(store: Store, composed: ComposedEntry): ManifestEntry {
  const record: CareerRecord = composed.record;
  return {
    record,
    organisation: organisationOf(store, record.organisationId),
    summaryRevisionId: summaryOf(store, record.summarySetId),
    links: inOrder(live(store.recordLinks).filter((row) => row.recordId === record.id)),
    fields: inOrder(live(store.recordFields).filter((row) => row.recordId === record.id)),
    tags: tagLabels(
      store,
      store.recordTags.filter((row) => row.recordId === record.id).map((row) => row.tagId),
    ),
    points: pointsOf(store, composed),
  };
}

function contactsOf(store: Store, resumeId: Uuid): ContactChannel[] {
  const overrides = new Map(
    store.resumeContactChannels
      .filter((row) => row.resumeId === resumeId)
      .map((row) => [row.contactChannelId, row.isVisible]),
  );
  return inOrder(
    live(store.contactChannels).filter(
      (channel) => overrides.get(channel.id) ?? channel.isDefaultVisible,
    ),
  );
}

// What the resume says right now, frozen: pinning only phrasing revisions would
// leave titles, dates and links live, so correcting one in 2027 would rewrite
// what a 2026 snapshot claims was sent (data-model.md #9.3).
export function captureManifest(store: Store, resumeId: Uuid): ResumeManifest | undefined {
  const composed = composition(store, resumeId);
  if (composed === undefined) return undefined;

  const { profile } = store;
  const sections: ManifestSection[] = composed.sections
    .filter((row) => row.section.isVisible)
    .map((row) => {
      return {
        kind: row.section.kind,
        heading: sectionHeading(store, row.section),
        layout: row.section.layout ?? "entries",
        entries: row.entries
          .filter((entry) => entry.entry.isVisible && entry.record.archivedAt === null)
          .map((entry) => entryOf(store, entry)),
      };
    });

  // Parsed rather than returned as built: the rows above are the caller's own
  // objects, and a manifest that changes when one of them is edited is not
  // pinned at all.
  return resumeManifestSchema.parse({
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    resume: {
      name: composed.resume.name,
      targetCompany: composed.resume.targetCompany,
      targetRole: composed.resume.targetRole,
      targetUrl: composed.resume.targetUrl,
      appliedOn: composed.resume.appliedOn,
    },
    profile: {
      fullName: profile.fullName,
      headline: profile.headline,
      pronouns: profile.pronouns,
      location: profile.location,
      summaryRevisionId: summaryOf(store, profile.summarySetId),
      contacts: contactsOf(store, resumeId),
    },
    sections,
  });
}

export interface ManifestRef {
  refKind: ContentRefKind;
  refId: Uuid;
}

// The usage index, projected out of a manifest: what "which resumes used this
// point?" reads (data-model.md #9.2).
export function manifestRefs(manifest: ResumeManifest): ManifestRef[] {
  const refs = new Map<string, ManifestRef>();
  const add = (refKind: ContentRefKind, refId: Uuid | null) => {
    if (refId !== null) refs.set(`${refKind}:${refId}`, { refKind, refId });
  };

  for (const contact of manifest.profile.contacts) add("contact_channel", contact.id);
  add("phrasing_revision", manifest.profile.summaryRevisionId);

  for (const section of manifest.sections) {
    for (const entry of section.entries) {
      add("record", entry.record.id);
      add("phrasing_revision", entry.summaryRevisionId);
      for (const point of entry.points) {
        add("point", point.pointId);
        add("phrasing_revision", point.phrasingRevisionId);
      }
    }
  }
  return [...refs.values()];
}
