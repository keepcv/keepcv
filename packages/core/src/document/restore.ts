import type {
  ManifestEntry,
  ManifestPoint,
  ManifestSection,
  ManifestTarget,
  PhrasingRevision,
  RestoreOmission,
  Resume,
  ResumeContactChannel,
  ResumeEntryPatch,
  ResumeEntryPointPatch,
  ResumeManifest,
  ResumePatch,
  ResumeSectionPatch,
  SectionKind,
  SortKey,
  Store,
  Timestamp,
  Uuid,
} from "@keepcv/schema";
import { newUuid } from "../identity/uuid.js";
import { DEFAULT_SECTION_LAYOUT, live, sectionHeading } from "../store/selectors.js";
import { above, type CompositionPlan, change, emptyPlan, type PlanChange, sparse } from "./plan.js";

export interface RestorePlan extends CompositionPlan {
  resume: PlanChange<ResumePatch> | null;
  contacts: ResumeContactChannel[];
  revertedContacts: Uuid[];
  omissions: RestoreOmission[];
}

interface Existing {
  id: Uuid;
  sortKey: SortKey;
  isVisible: boolean;
  archivedAt: string | null;
  updatedAt: Timestamp;
}

interface Placed<Source> {
  source: Source;
  id: Uuid;
}

// Keys are left where they are when the rows already sit in the order the
// manifest wants, so restoring a resume nothing has moved on writes nothing.
function ordered<Slot extends { found: Existing | undefined }>(
  slots: readonly Slot[],
  existing: readonly Existing[],
): (Slot & { sortKey: SortKey })[] {
  const settled = slots.every(
    (slot, at) =>
      slot.found !== undefined &&
      (at === 0 || (slots[at - 1]?.found?.sortKey ?? "") < slot.found.sortKey),
  );
  const next = above(existing.map((row) => row.sortKey));

  return slots.map((slot) => ({
    ...slot,
    sortKey: settled && slot.found !== undefined ? slot.found.sortKey : next(),
  }));
}

// Toggled off rather than archived: what a resume prints is `is_visible`, and
// the phrasing choice and the position survive it.
function hidden<Row extends Existing>(rows: readonly Row[], kept: ReadonlySet<Uuid>) {
  return rows
    .filter((row) => !kept.has(row.id) && row.isVisible && row.archivedAt === null)
    .map((row) => ({
      id: row.id,
      patch: { isVisible: false as const },
      expectedUpdatedAt: row.updatedAt,
      unarchive: false,
    }));
}

// `resume_section_kind_unique` is the identity: one section per kind, except
// `custom`, which is one per heading.
function sectionKey(kind: SectionKind, heading: string): string {
  return kind === "custom" ? `custom:${heading}` : kind;
}

// No `targetJdText`: the manifest does not pin it, because it is what the
// resume was composed against rather than part of what was sent.
function targetPatch(resume: Resume, target: ManifestTarget): ResumePatch | null {
  const patch = sparse<ResumePatch>(
    {
      name: target.name,
      targetCompany: target.targetCompany,
      targetRole: target.targetRole,
      targetUrl: target.targetUrl,
      appliedOn: target.appliedOn,
    },
    resume,
  );
  return Object.keys(patch).length === 0 ? null : patch;
}

function planSections(
  store: Store,
  resume: Resume,
  manifest: ResumeManifest,
  plan: RestorePlan,
): Placed<ManifestSection>[] {
  const existing = store.resumeSections.filter((row) => row.resumeId === resume.id);
  const byKey = new Map(
    existing.map((row) => [sectionKey(row.kind, sectionHeading(store, row)), row]),
  );

  const slots = manifest.sections.flatMap((source) => {
    const found = byKey.get(sectionKey(source.kind, source.heading));
    const customSectionId =
      found?.customSectionId ??
      live(store.customSections).find((row) => row.heading === source.heading)?.id ??
      null;

    if (source.kind === "custom" && customSectionId === null) {
      plan.omissions.push({ subject: "section", reference: source.heading });
      return [];
    }

    // The manifest resolved both, so writing them back verbatim would pin an
    // override on a section that only ever printed its kind's defaults.
    const bare = sectionHeading(store, { kind: source.kind, customSectionId, heading: null });
    const heading = source.heading === bare ? null : source.heading;
    const layout = source.layout === DEFAULT_SECTION_LAYOUT ? null : source.layout;
    return [{ source, found, customSectionId, heading, layout }];
  });

  const kept = new Set<Uuid>();
  const placed = ordered(slots, existing).map(
    ({ source, found, customSectionId, heading, layout, sortKey }): Placed<ManifestSection> => {
      if (found === undefined) {
        const id = newUuid();
        plan.addSections.push({
          id,
          resumeId: resume.id,
          kind: source.kind,
          customSectionId,
          heading,
          layout,
          sortKey,
          isVisible: true,
        });
        return { source, id };
      }

      kept.add(found.id);
      const wanted = { heading, layout, sortKey, isVisible: true };
      plan.sections.push(...change(found, sparse<ResumeSectionPatch>(wanted, found)));
      return { source, id: found.id };
    },
  );

  plan.sections.push(...hidden(existing, kept));
  return placed;
}

function planEntries(
  store: Store,
  resume: Resume,
  sections: readonly Placed<ManifestSection>[],
  plan: RestorePlan,
): Placed<ManifestEntry>[] {
  const all = store.resumeEntries.filter((row) => row.resumeId === resume.id);
  const kept = new Set<Uuid>();

  const placed = sections.flatMap((section) => {
    const existing = all.filter((row) => row.resumeSectionId === section.id);
    const byRecord = new Map(existing.map((row) => [row.recordId, row]));

    const slots = section.source.entries.flatMap((source) => {
      if (store.records.some((row) => row.id === source.record.id)) {
        return [{ source, found: byRecord.get(source.record.id) }];
      }
      plan.omissions.push({ subject: "entry", reference: source.record.title ?? source.record.id });
      return [];
    });

    return ordered(slots, existing).map(({ source, found, sortKey }): Placed<ManifestEntry> => {
      if (found === undefined) {
        const id = newUuid();
        plan.addEntries.push({
          id,
          resumeId: resume.id,
          resumeSectionId: section.id,
          recordId: source.record.id,
          sortKey,
          isVisible: true,
        });
        return { source, id };
      }

      kept.add(found.id);
      plan.entries.push(
        ...change(found, sparse<ResumeEntryPatch>({ sortKey, isVisible: true }, found)),
      );
      return { source, id: found.id };
    });
  });

  plan.entries.push(...hidden(all, kept));
  return placed;
}

// The wording a version pinned is a revision; a resume selects the phrasing it
// belongs to, so what a restore prints is that phrasing as it reads today.
function phrasingFor(
  store: Store,
  phrasingOf: ReadonlyMap<Uuid, Uuid>,
  source: ManifestPoint,
): Uuid | null {
  const phrasingId = phrasingOf.get(source.phrasingRevisionId);
  if (phrasingId === undefined) return null;
  if (!store.phrasings.some((row) => row.id === phrasingId)) return null;
  return store.points.some((row) => row.id === source.pointId) ? phrasingId : null;
}

function planEntryPoints(
  store: Store,
  resume: Resume,
  entries: readonly Placed<ManifestEntry>[],
  revisions: readonly PhrasingRevision[],
  plan: RestorePlan,
): void {
  const phrasingOf = new Map(revisions.map((row) => [row.id, row.phrasingId]));
  const all = store.resumeEntryPoints.filter((row) => row.resumeId === resume.id);
  // I13: one row per point per resume, so the point identifies it across the
  // whole resume rather than within an entry.
  const byPoint = new Map(all.map((row) => [row.pointId, row]));
  const kept = new Set<Uuid>();

  for (const entry of entries) {
    const existing = all.filter((row) => row.resumeEntryId === entry.id);
    const slots = entry.source.points.flatMap((source) => {
      const phrasingId = phrasingFor(store, phrasingOf, source);
      if (phrasingId === null) {
        plan.omissions.push({ subject: "point", reference: source.pointId });
        return [];
      }
      return [{ source, phrasingId, found: byPoint.get(source.pointId) }];
    });

    for (const { source, phrasingId, found, sortKey } of ordered(slots, existing)) {
      if (found === undefined) {
        plan.addEntryPoints.push({
          id: newUuid(),
          resumeId: resume.id,
          resumeEntryId: entry.id,
          pointId: source.pointId,
          phrasingId,
          sortKey,
          isVisible: true,
        });
        continue;
      }

      kept.add(found.id);
      // I13 again: no patch can move the row between entries, so one whose
      // point has changed record since keeps its place and takes the pinned
      // wording.
      const stranded = found.resumeEntryId !== entry.id;
      if (stranded) plan.omissions.push({ subject: "point", reference: source.pointId });
      const wanted = {
        phrasingId,
        sortKey: stranded ? undefined : sortKey,
        isVisible: true,
      };
      plan.entryPoints.push(...change(found, sparse<ResumeEntryPointPatch>(wanted, found)));
    }
  }

  plan.entryPoints.push(...hidden(all, kept));
}

function planContacts(
  store: Store,
  resume: Resume,
  manifest: ResumeManifest,
  plan: RestorePlan,
): void {
  const printed = new Set(manifest.profile.contacts.map((row) => row.id));
  const overrides = new Map(
    store.resumeContactChannels
      .filter((row) => row.resumeId === resume.id)
      .map((row) => [row.contactChannelId, row.isVisible]),
  );

  for (const channel of live(store.contactChannels)) {
    const wanted = printed.has(channel.id);
    // Cleared rather than pinned when the channel's own default already says
    // it, so a later change to that default still reaches this resume.
    if (wanted === channel.isDefaultVisible) {
      if (overrides.has(channel.id)) plan.revertedContacts.push(channel.id);
    } else if (overrides.get(channel.id) !== wanted) {
      plan.contacts.push({ resumeId: resume.id, contactChannelId: channel.id, isVisible: wanted });
    }
  }
}

// A manifest written back over the working composition, as the changes to make
// rather than as rows. What a version pinned is the selection, so the records
// and the wordings themselves are left exactly as they are.
export function restorePlan(
  store: Store,
  resumeId: Uuid,
  manifest: ResumeManifest,
  revisions: readonly PhrasingRevision[],
): RestorePlan | undefined {
  const resume = store.resumes.find((row) => row.id === resumeId);
  if (resume === undefined) return undefined;

  const target = targetPatch(resume, manifest.resume);
  const plan: RestorePlan = {
    ...emptyPlan(resumeId),
    resume:
      target === null
        ? null
        : { id: resume.id, patch: target, expectedUpdatedAt: resume.updatedAt, unarchive: false },
    contacts: [],
    revertedContacts: [],
    omissions: [],
  };

  const sections = planSections(store, resume, manifest, plan);
  planEntryPoints(store, resume, planEntries(store, resume, sections, plan), revisions, plan);
  planContacts(store, resume, manifest, plan);
  return plan;
}
