import { customSectionSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { newUuid } from "../identity/uuid.js";
import {
  aContactChannel,
  anEntry,
  anEntryPoint,
  anOrganisation,
  aPoint,
  aRecord,
  aResume,
  aSection,
  aTag,
  emptyStore,
  standard,
} from "../store/store.harness.js";
import { captureManifest, manifestRefs } from "./capture.js";
import { renderManifest } from "./render.js";

const AT = "2026-08-17T09:00:00.000Z";

function aComposedStore() {
  const store = emptyStore();
  const acme = anOrganisation("Acme", { website: "https://acme.example", location: "London" });
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
  const point = aPoint(store, "Cut p95 latency from 800ms to 120ms", { recordId: role.id });
  anEntryPoint(store, entry, point, { sortKey: "a0" });
  aContactChannel(store, "email", "ada@example.com");

  return { store, resume, role, point, acme };
}

describe("captureManifest", () => {
  it("answers with nothing for a resume that is not in the store", () => {
    expect(captureManifest(emptyStore(), newUuid())).toBeUndefined();
  });

  it("pins the target context, so editing it later does not rewrite history", () => {
    const { store, resume } = aComposedStore();
    resume.targetCompany = "Acme";
    resume.targetRole = "Staff Engineer";

    const manifest = captureManifest(store, resume.id);
    resume.name = "Renamed";
    resume.targetCompany = "Zeta";

    expect(manifest?.resume).toEqual({
      name: "Backend, Acme",
      targetCompany: "Acme",
      targetRole: "Staff Engineer",
      targetUrl: null,
      appliedOn: null,
    });
  });

  // The whole reason a manifest exists: what a version says was sent has to
  // survive every later edit to the store (data-model.md #9.3).
  it("renders the same document after the store has moved on", () => {
    const { store, resume, role, acme } = aComposedStore();
    const manifest = captureManifest(store, resume.id);
    if (manifest === undefined) throw new Error("the resume just composed is not there");
    const before = renderManifest(manifest, store.phrasingRevisions, { generatedAt: AT });

    role.title = "A title written in 2027";
    acme.name = "Acme, renamed";
    store.profile.fullName = "Someone Else";

    expect(renderManifest(manifest, store.phrasingRevisions, { generatedAt: AT })).toEqual(before);
    expect(before.sections[0]?.entries[0]?.title).toBe("Staff Engineer");
  });

  it("resolves a heading once, so renaming a custom section does not reword it", () => {
    const store = emptyStore();
    const custom = customSectionSchema.parse({ ...standard(), heading: "Patents", sortKey: "a0" });
    store.customSections.push(custom);
    const resume = aResume(store, "With patents");
    aSection(store, resume.id, "custom", { sortKey: "a0", customSectionId: custom.id });

    const manifest = captureManifest(store, resume.id);
    custom.heading = "Filings";

    expect(manifest?.sections[0]?.heading).toBe("Patents");
  });

  it("names every row a version prints, and nothing it does not", () => {
    const { store, resume, role, point } = aComposedStore();
    const react = aTag(store, "React");
    store.recordTags.push({ recordId: role.id, tagId: react.id });
    const manifest = captureManifest(store, resume.id);
    if (manifest === undefined) throw new Error("the resume just composed is not there");

    const refs = manifestRefs(manifest);
    expect(refs).toContainEqual({ refKind: "record", refId: role.id });
    expect(refs).toContainEqual({ refKind: "point", refId: point.id });
    expect(refs.filter((ref) => ref.refKind === "phrasing_revision")).toHaveLength(1);
    expect(refs.filter((ref) => ref.refKind === "contact_channel")).toHaveLength(1);
    // A tag is pinned by label, so it is not a row anything points back at.
    expect(refs.map((ref) => ref.refKind)).not.toContain("tag");
  });
});
