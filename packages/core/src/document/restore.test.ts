import type { Phrasing, Point, ResumeManifest, Store, Uuid } from "@keepcv/schema";
import { customSectionSchema, sortKeySchema, timestampSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { newUuid } from "../identity/uuid.js";
import {
  aContactChannel,
  anEntry,
  anEntryPoint,
  aPoint,
  aRecord,
  aResume,
  aSection,
  emptyStore,
  standard,
} from "../store/store.harness.js";
import { captureManifest } from "./capture.js";
import { restorePlan } from "./restore.js";

function wordingOf(store: Store, point: Point): Phrasing {
  const found = store.phrasings.find((row) => row.phrasingSetId === point.phrasingSetId);
  if (found === undefined) throw new Error("a point is written with the wording it holds");
  return found;
}

function aComposedStore() {
  const store = emptyStore();
  const role = aRecord({ kind: "experience", title: "Staff Engineer" });
  const engine = aRecord({ kind: "project", title: "Difference Engine" });
  store.records.push(role, engine);

  const resume = aResume(store, "Backend, Acme");
  const experience = aSection(store, resume.id, "experience", { sortKey: "a0" });
  const entry = anEntry(store, experience, role.id, { sortKey: "a0" });
  const latency = aPoint(store, "Cut p95 latency to 120ms", { recordId: role.id });
  const scheduler = aPoint(store, "Rewrote the scheduler", { recordId: role.id, sortKey: "a1" });
  anEntryPoint(store, entry, latency, { sortKey: "a0" });
  anEntryPoint(store, entry, scheduler, { sortKey: "a1" });

  return { store, resume, role, engine, experience, entry, latency, scheduler };
}

function capture(store: Store, resumeId: Uuid): ResumeManifest {
  const manifest = captureManifest(store, resumeId);
  if (manifest === undefined) throw new Error("the resume just composed is not there");
  return manifest;
}

function plan(store: Store, resumeId: Uuid, manifest: ResumeManifest) {
  const built = restorePlan(store, resumeId, manifest, store.phrasingRevisions);
  if (built === undefined) throw new Error("the resume just composed is not there");
  return built;
}

describe("restorePlan", () => {
  it("answers with nothing for a resume that is not in the store", () => {
    const { store, resume } = aComposedStore();
    expect(restorePlan(store, newUuid(), capture(store, resume.id), [])).toBeUndefined();
  });

  // Every change here bumps a concurrency token, so a restore that agrees with
  // the store would refuse an edit open in another tab for no reason.
  it("writes nothing at all when the resume has not moved since", () => {
    const { store, resume } = aComposedStore();
    const built = plan(store, resume.id, capture(store, resume.id));

    expect(built).toEqual({
      resumeId: resume.id,
      resume: null,
      addSections: [],
      sections: [],
      addEntries: [],
      entries: [],
      addEntryPoints: [],
      entryPoints: [],
      contacts: [],
      revertedContacts: [],
      omissions: [],
    });
  });

  it("puts back an entry that was toggled off, and the target context with it", () => {
    const { store, resume, entry } = aComposedStore();
    const manifest = capture(store, resume.id);

    entry.isVisible = false;
    resume.targetCompany = "Zeta";
    const built = plan(store, resume.id, manifest);

    expect(built.resume?.patch).toEqual({ targetCompany: null });
    expect(built.entries).toEqual([
      {
        id: entry.id,
        patch: { isVisible: true },
        expectedUpdatedAt: entry.updatedAt,
        unarchive: false,
      },
    ]);
  });

  // What a resume prints is `is_visible`: archiving the row would take the
  // phrasing choice and the position with it (data-model.md #9.1).
  it("toggles off what the manifest does not name rather than archiving it", () => {
    const { store, resume, experience, engine, latency } = aComposedStore();
    const manifest = capture(store, resume.id);

    const extra = anEntry(store, experience, engine.id, { sortKey: "Zz" });
    const placed = store.resumeEntryPoints.find((row) => row.pointId === latency.id);
    const built = plan(store, resume.id, manifest);

    expect(built.entries.map((row) => [row.id, row.patch])).toEqual([
      [extra.id, { isVisible: false }],
    ]);
    expect(built.entryPoints).toEqual([]);
    expect(placed?.archivedAt).toBeNull();
  });

  it("brings back a section that was archived since", () => {
    const { store, resume, experience } = aComposedStore();
    const manifest = capture(store, resume.id);

    experience.archivedAt = timestampSchema.parse("2026-06-01T00:00:00.000Z");
    const built = plan(store, resume.id, manifest);

    expect(built.sections).toHaveLength(1);
    expect(built.sections[0]?.unarchive).toBe(true);
    expect(built.addSections).toEqual([]);
  });

  it("adds back a whole section, its entry and its points", () => {
    const { store, resume, engine } = aComposedStore();
    const projects = aSection(store, resume.id, "project", { sortKey: "a1" });
    const entry = anEntry(store, projects, engine.id, { sortKey: "a0" });
    const point = aPoint(store, "Built the mill", { recordId: engine.id });
    anEntryPoint(store, entry, point, { sortKey: "a0" });
    const manifest = capture(store, resume.id);

    store.resumeSections = store.resumeSections.filter((row) => row.id !== projects.id);
    store.resumeEntries = store.resumeEntries.filter((row) => row.id !== entry.id);
    store.resumeEntryPoints = store.resumeEntryPoints.filter((row) => row.pointId !== point.id);
    const built = plan(store, resume.id, manifest);

    expect(built.addSections.map((row) => row.kind)).toEqual(["project"]);
    expect(built.addEntries.map((row) => row.recordId)).toEqual([engine.id]);
    expect(built.addEntryPoints.map((row) => row.pointId)).toEqual([point.id]);
    expect(built.addEntryPoints[0]?.resumeEntryId).toBe(built.addEntries[0]?.id);
  });

  // The kind is the identity, not the heading: matching on the heading would
  // add a second experience section and hit `resume_section_kind_unique`.
  it("matches a section whose heading was overridden since", () => {
    const { store, resume, experience } = aComposedStore();
    const manifest = capture(store, resume.id);

    experience.heading = "What I have done";
    const built = plan(store, resume.id, manifest);

    expect(built.addSections).toEqual([]);
    expect(built.sections[0]?.patch).toEqual({ heading: null });
  });

  it("says which custom heading it could not put back", () => {
    const store = emptyStore();
    const custom = customSectionSchema.parse({ ...standard(), heading: "Patents", sortKey: "a0" });
    store.customSections.push(custom);
    const resume = aResume(store, "With patents");
    const section = aSection(store, resume.id, "custom", {
      sortKey: "a0",
      customSectionId: custom.id,
    });
    const manifest = capture(store, resume.id);

    store.customSections = [];
    store.resumeSections = store.resumeSections.filter((row) => row.id !== section.id);
    const built = plan(store, resume.id, manifest);

    expect(built.omissions).toEqual([{ subject: "section", reference: "Patents" }]);
    expect(built.addSections).toEqual([]);
  });

  it("re-keys a whole list when the order the manifest wants is not the order it is in", () => {
    const { store, resume, latency, scheduler } = aComposedStore();
    const manifest = capture(store, resume.id);

    const first = store.resumeEntryPoints.find((row) => row.pointId === latency.id);
    if (first !== undefined) first.sortKey = sortKeySchema.parse("a2");
    const built = plan(store, resume.id, manifest);

    const keys = built.entryPoints.map((row) => [row.id, row.patch]);
    expect(keys).toHaveLength(2);
    expect(built.entryPoints.every((row) => "sortKey" in row.patch)).toBe(true);
    const ordering = built.entryPoints.map((row) => row.id);
    expect(ordering).toEqual([
      store.resumeEntryPoints.find((row) => row.pointId === latency.id)?.id,
      store.resumeEntryPoints.find((row) => row.pointId === scheduler.id)?.id,
    ]);
  });

  // A resume selects a phrasing, not a revision: the version keeps the words it
  // pinned, and the restored composition prints what that phrasing says now.
  it("selects the phrasing the pinned revision belongs to", () => {
    const { store, resume, entry, latency } = aComposedStore();
    const manifest = capture(store, resume.id);

    const placed = store.resumeEntryPoints.find((row) => row.pointId === latency.id);
    const other = wordingOf(store, latency);
    store.resumeEntryPoints = store.resumeEntryPoints.filter((row) => row.id !== placed?.id);
    const built = plan(store, resume.id, manifest);

    expect(
      built.addEntryPoints.map((row) => [row.pointId, row.phrasingId, row.resumeEntryId]),
    ).toEqual([[latency.id, other.id, entry.id]]);
  });

  it("says which point it could not put back when the wording is gone", () => {
    const { store, resume, latency } = aComposedStore();
    const manifest = capture(store, resume.id);

    const wording = wordingOf(store, latency);
    store.phrasings = store.phrasings.filter((row) => row.id !== wording.id);
    const built = plan(store, resume.id, manifest);

    expect(built.omissions).toEqual([{ subject: "point", reference: latency.id }]);
  });

  it("reverts a contact override the version did not need, and pins the one it did", () => {
    const { store, resume } = aComposedStore();
    const shown = aContactChannel(store, "email", "ada@example.org");
    const hidden = aContactChannel(store, "phone", "0123", { isDefaultVisible: false });
    store.resumeContactChannels.push({
      resumeId: resume.id,
      contactChannelId: hidden.id,
      isVisible: true,
    });
    const manifest = capture(store, resume.id);

    store.resumeContactChannels = [
      { resumeId: resume.id, contactChannelId: shown.id, isVisible: false },
    ];
    const built = plan(store, resume.id, manifest);

    expect(built.revertedContacts).toEqual([shown.id]);
    expect(built.contacts).toEqual([
      { resumeId: resume.id, contactChannelId: hidden.id, isVisible: true },
    ]);
  });
});
