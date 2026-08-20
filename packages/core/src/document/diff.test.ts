import type { Phrasing, Point, ResumeManifest, Store, Uuid } from "@keepcv/schema";
import { partialDateSchema, sortKeySchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import {
  anEntry,
  anEntryPoint,
  anOrganisation,
  aPoint,
  aRecord,
  aResume,
  aSection,
  emptyStore,
  reword,
} from "../store/store.harness.js";
import { captureManifest } from "./capture.js";
import { diffManifests } from "./diff.js";

function wordingOf(store: Store, point: Point): Phrasing {
  const found = store.phrasings.find((row) => row.phrasingSetId === point.phrasingSetId);
  if (found === undefined) throw new Error("a point is written with the wording it holds");
  return found;
}

function aComposedStore() {
  const store = emptyStore();
  const acme = anOrganisation("Acme");
  store.organisations.push(acme);

  const role = aRecord({
    kind: "experience",
    title: "Staff Engineer",
    organisationId: acme.id,
    startedOn: "2024-03",
    isCurrent: true,
  });
  store.records.push(role);

  const resume = aResume(store, "Backend, Acme");
  const section = aSection(store, resume.id, "experience", { sortKey: "a0" });
  const entry = anEntry(store, section, role.id, { sortKey: "a0" });
  const latency = aPoint(store, "Cut p95 latency to 120ms", { recordId: role.id });
  anEntryPoint(store, entry, latency, { sortKey: "a0" });

  return { store, resume, role, section, entry, latency };
}

function capture(store: Store, resumeId: Uuid): ResumeManifest {
  const manifest = captureManifest(store, resumeId);
  if (manifest === undefined) throw new Error("the resume just composed is not there");
  return manifest;
}

describe("diffManifests", () => {
  it("says nothing about two captures of a store that has not moved", () => {
    const { store, resume } = aComposedStore();
    const before = capture(store, resume.id);
    const after = capture(store, resume.id);

    expect(diffManifests(before, after, store.phrasingRevisions)).toEqual({
      target: [],
      profile: [],
      sections: [],
    });
  });

  it("carries both wordings, so nothing has to be fetched to read the change", () => {
    const { store, resume, latency } = aComposedStore();
    const before = capture(store, resume.id);
    reword(store, wordingOf(store, latency), "Cut p95 latency from 800ms to 120ms");
    const after = capture(store, resume.id);

    const diff = diffManifests(before, after, store.phrasingRevisions);
    const point = diff.sections[0]?.entries[0]?.points[0];

    expect(diff.sections[0]?.change).toBe("changed");
    expect(diff.sections[0]?.entries[0]?.change).toBe("changed");
    expect(point?.change).toBe("changed");
    expect(point?.fields).toEqual([
      { field: "wording", a: "Cut p95 latency to 120ms", b: "Cut p95 latency from 800ms to 120ms" },
    ]);
  });

  it("reports an added point and a removed one from the side each is on", () => {
    const { store, resume, entry, latency } = aComposedStore();
    const before = capture(store, resume.id);

    const scheduler = aPoint(store, "Rewrote the scheduler", { sortKey: "a1" });
    anEntryPoint(store, entry, scheduler, { sortKey: "a1" });
    const placed = store.resumeEntryPoints.find((row) => row.pointId === latency.id);
    if (placed !== undefined) placed.isVisible = false;
    const after = capture(store, resume.id);

    const points = diffManifests(before, after, store.phrasingRevisions).sections[0]?.entries[0]
      ?.points;
    expect(points?.map((row) => [row.change, row.fields[0]?.b ?? row.fields[0]?.a])).toEqual([
      ["added", "Rewrote the scheduler"],
      ["removed", "Cut p95 latency to 120ms"],
    ]);
  });

  // Measured by raw index, an insertion at the top would report every entry
  // below it as moved and bury the one thing that actually happened.
  it("calls nothing moved when a new entry pushes the others down", () => {
    const { store, resume, section } = aComposedStore();
    const before = capture(store, resume.id);

    const project = aRecord({ kind: "project", title: "Difference Engine" });
    store.records.push(project);
    anEntry(store, section, project.id, { sortKey: "Zz" });
    const after = capture(store, resume.id);

    const entries = diffManifests(before, after, store.phrasingRevisions).sections[0]?.entries;
    expect(entries?.map((row) => row.change)).toEqual(["added"]);
    expect(entries?.[0]?.title).toBe("Difference Engine");
  });

  it("calls two entries moved when they swap", () => {
    const { store, resume, section, entry } = aComposedStore();
    const project = aRecord({ kind: "project", title: "Difference Engine" });
    store.records.push(project);
    const second = anEntry(store, section, project.id, { sortKey: "a1" });
    const before = capture(store, resume.id);

    entry.sortKey = sortKeySchema.parse("a2");
    const after = capture(store, resume.id);

    const entries = diffManifests(before, after, store.phrasingRevisions).sections[0]?.entries;
    expect(entries?.map((row) => [row.recordId, row.change, row.aIndex, row.bIndex])).toEqual([
      [second.recordId, "moved", 1, 0],
      [entry.recordId, "moved", 0, 1],
    ]);
  });

  // The pinned row, not the live one: a title corrected in 2027 is the change
  // being reported, so reading it from the store would hide it.
  it("reads a corrected title off the two pinned records", () => {
    const { store, resume, role } = aComposedStore();
    const before = capture(store, resume.id);
    role.title = "Principal Engineer";
    const after = capture(store, resume.id);

    const entry = diffManifests(before, after, store.phrasingRevisions).sections[0]?.entries[0];
    expect(entry?.change).toBe("changed");
    expect(entry?.title).toBe("Principal Engineer");
    expect(entry?.fields).toEqual([
      { field: "title", a: "Staff Engineer", b: "Principal Engineer" },
    ]);
  });

  it("reports the target context and the profile without touching the sections", () => {
    const { store, resume } = aComposedStore();
    const before = capture(store, resume.id);
    resume.targetCompany = "Zeta";
    resume.appliedOn = partialDateSchema.parse("2026-03-02");
    store.profile.headline = "Engine lead";
    const after = capture(store, resume.id);

    const diff = diffManifests(before, after, store.phrasingRevisions);
    expect(diff.target).toEqual([
      { field: "targetCompany", a: null, b: "Zeta" },
      { field: "appliedOn", a: null, b: "2026-03-02" },
    ]);
    expect(diff.profile).toEqual([{ field: "headline", a: null, b: "Engine lead" }]);
    expect(diff.sections).toEqual([]);
  });

  it("reports a whole section arriving, with everything under it", () => {
    const { store, resume } = aComposedStore();
    const before = capture(store, resume.id);

    const project = aRecord({ kind: "project", title: "Difference Engine" });
    store.records.push(project);
    const projects = aSection(store, resume.id, "project", { sortKey: "a1" });
    anEntry(store, projects, project.id, { sortKey: "a0" });
    const after = capture(store, resume.id);

    const sections = diffManifests(before, after, store.phrasingRevisions).sections;
    expect(sections.map((row) => [row.heading, row.change])).toEqual([["Projects", "added"]]);
    expect(sections[0]?.entries.map((row) => row.change)).toEqual(["added"]);
  });
});
