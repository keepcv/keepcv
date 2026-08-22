import { uuidSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import {
  anEntry,
  anEntryPoint,
  aPoint,
  aRecord,
  aResume,
  aSection,
  emptyStore,
} from "../store/store.harness.js";
import { derivePlan } from "./derive.js";

const INTO = {
  id: uuidSchema.parse("0195f7a0-0000-7000-8000-00000000dede"),
  name: "Backend, Acme",
};

function aComposedStore() {
  const store = emptyStore();
  const record = aRecord({ kind: "experience", title: "Engine lead" });
  store.records.push(record);
  const point = aPoint(store, "Cut p95 latency", { recordId: record.id });

  const resume = aResume(store, "Staff engineer", {
    targetCompany: "Babbage Ltd",
    targetJdText: "a posting",
    appliedOn: "2026-02-10",
    templateId: "ats-single-column",
    templateConfig: { fontSize: 11 },
    pageLimit: 1,
  });
  const section = aSection(store, resume.id, "experience");
  const entry = anEntry(store, section, record.id);
  anEntryPoint(store, entry, point);

  return { store, resume, record, point, section, entry };
}

describe("deriving a resume from another", () => {
  it("answers nothing for a resume the store does not hold", () => {
    expect(derivePlan(emptyStore(), INTO.id, INTO)).toBeUndefined();
  });

  it("copies the selection whole", () => {
    const { store, record, point } = aComposedStore();
    const plan = derivePlan(store, store.resumes[0]?.id ?? INTO.id, INTO);

    expect(plan?.sections).toHaveLength(1);
    expect(plan?.entries[0]).toMatchObject({ recordId: record.id, resumeId: INTO.id });
    expect(plan?.entryPoints[0]).toMatchObject({ pointId: point.id, resumeId: INTO.id });
  });

  // Every row is new, and every parent reference points inside the new resume:
  // a copied id would make the two resumes one row.
  it("mints an id for every row and rewires the references", () => {
    const { store, section, entry } = aComposedStore();
    const plan = derivePlan(store, store.resumes[0]?.id ?? INTO.id, INTO);

    expect(plan?.sections[0]?.id).not.toBe(section.id);
    expect(plan?.entries[0]?.id).not.toBe(entry.id);
    expect(plan?.entries[0]?.resumeSectionId).toBe(plan?.sections[0]?.id);
    expect(plan?.entryPoints[0]?.resumeEntryId).toBe(plan?.entries[0]?.id);
  });

  it("takes the template and the page limit but never the posting", () => {
    const { store } = aComposedStore();
    const plan = derivePlan(store, store.resumes[0]?.id ?? INTO.id, INTO);

    expect(plan?.resume).toMatchObject({
      name: "Backend, Acme",
      templateId: "ats-single-column",
      templateConfig: { fontSize: 11 },
      pageLimit: 1,
      targetCompany: null,
      targetJdText: null,
      appliedOn: null,
    });
  });

  // Off is a state of the selection, so it comes across; archived is a row the
  // user took off, and copying it would put it back.
  it("carries a toggled-off row across and leaves an archived one behind", () => {
    const { store, resume, record } = aComposedStore();
    const projects = aSection(store, resume.id, "project", { sortKey: "a1", isVisible: false });
    anEntry(store, projects, record.id);
    aSection(store, resume.id, "award", { sortKey: "a2", archivedAt: "2026-02-01T00:00:00.000Z" });

    const plan = derivePlan(store, resume.id, INTO);

    expect(plan?.sections).toHaveLength(2);
    expect(plan?.sections.map((row) => row.isVisible)).toEqual([true, false]);
    expect(plan?.sections.some((row) => row.kind === "award")).toBe(false);
  });

  // The wording this resume chose, not the canonical one: the point of deriving
  // is to start from the selection that was made.
  it("keeps the wording each placed point was pinned to", () => {
    const { store, resume, entry, point } = aComposedStore();
    const chosen = store.resumeEntryPoints[0]?.phrasingId;
    anEntryPoint(store, entry, aPoint(store, "Rewrote the scheduler"), { sortKey: "a1" });

    const plan = derivePlan(store, resume.id, INTO);

    expect(plan?.entryPoints[0]?.phrasingId).toBe(chosen);
    expect(plan?.entryPoints[0]?.pointId).toBe(point.id);
  });

  it("brings the contact overrides with it", () => {
    const { store, resume } = aComposedStore();
    store.resumeContactChannels.push({
      resumeId: resume.id,
      contactChannelId: INTO.id,
      isVisible: false,
    });

    expect(derivePlan(store, resume.id, INTO)?.contacts).toEqual([
      { resumeId: INTO.id, contactChannelId: INTO.id, isVisible: false },
    ]);
  });
});
