import type {
  ResumeContactChannel,
  ResumeEntryInput,
  ResumeEntryPointInput,
  ResumeInput,
  ResumeSectionInput,
  Store,
  Uuid,
} from "@keepcv/schema";
import { newUuid } from "../identity/uuid.js";
import { live } from "../store/selectors.js";

export interface DerivePlan {
  resume: ResumeInput;
  sections: ResumeSectionInput[];
  entries: ResumeEntryInput[];
  entryPoints: ResumeEntryPointInput[];
  contacts: ResumeContactChannel[];
}

// Live rows only. An archived one is a row the user took off this resume, and
// carrying it across would either put it back or start the new resume holding
// something already removed.
export function derivePlan(
  store: Store,
  resumeId: Uuid,
  into: { id: Uuid; name: string },
): DerivePlan | undefined {
  const source = store.resumes.find((row) => row.id === resumeId);
  if (source === undefined) return undefined;

  const sections = live(store.resumeSections).filter((row) => row.resumeId === resumeId);
  const sectionIds = new Map(sections.map((row) => [row.id, newUuid()]));

  const entries = live(store.resumeEntries).filter(
    (row) => row.resumeId === resumeId && sectionIds.has(row.resumeSectionId),
  );
  const entryIds = new Map(entries.map((row) => [row.id, newUuid()]));

  const entryPoints = live(store.resumeEntryPoints).filter(
    (row) => row.resumeId === resumeId && entryIds.has(row.resumeEntryId),
  );

  return {
    // The template, the page limit and every toggle come across; the posting
    // does not. A derived resume is the same shape aimed at a different opening,
    // and inheriting the old company would put the wrong posting behind the
    // match on the new one (application-structure.md #5.11).
    resume: {
      id: into.id,
      name: into.name,
      targetCompany: null,
      targetRole: null,
      targetUrl: null,
      targetJdText: null,
      appliedOn: null,
      templateId: source.templateId,
      templateConfig: source.templateConfig,
      pageLimit: source.pageLimit,
    },

    sections: sections.flatMap((row) => {
      const id = sectionIds.get(row.id);
      if (id === undefined) return [];
      return [
        {
          id,
          resumeId: into.id,
          kind: row.kind,
          customSectionId: row.customSectionId,
          heading: row.heading,
          layout: row.layout,
          sortKey: row.sortKey,
          isVisible: row.isVisible,
        },
      ];
    }),

    entries: entries.flatMap((row) => {
      const id = entryIds.get(row.id);
      const resumeSectionId = sectionIds.get(row.resumeSectionId);
      if (id === undefined || resumeSectionId === undefined) return [];
      return [
        {
          id,
          resumeId: into.id,
          resumeSectionId,
          recordId: row.recordId,
          sortKey: row.sortKey,
          isVisible: row.isVisible,
        },
      ];
    }),

    entryPoints: entryPoints.flatMap((row) => {
      const resumeEntryId = entryIds.get(row.resumeEntryId);
      if (resumeEntryId === undefined) return [];
      return [
        {
          id: newUuid(),
          resumeId: into.id,
          resumeEntryId,
          pointId: row.pointId,
          // The wording this resume chose, not the canonical one: the point of
          // deriving is to start from the selection that was made.
          phrasingId: row.phrasingId,
          sortKey: row.sortKey,
          isVisible: row.isVisible,
        },
      ];
    }),

    contacts: store.resumeContactChannels
      .filter((row) => row.resumeId === resumeId)
      .map((row) => ({ ...row, resumeId: into.id })),
  };
}
