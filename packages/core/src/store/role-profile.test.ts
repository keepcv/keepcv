import type { Store, Tag, Uuid } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { roleProfileAdds, roleProfileMatch, roleProfilePlan } from "./role-profile.js";
import {
  anEntry,
  anEntryPoint,
  aPoint,
  aRecord,
  aResume,
  aRoleProfile,
  aSection,
  aTag,
  emptyStore,
} from "./store.harness.js";

function tagRecord(store: Store, recordId: Uuid, tag: Tag): void {
  store.recordTags.push({ tagId: tag.id, recordId });
}

function tagPoint(store: Store, pointId: Uuid, tag: Tag): void {
  store.pointTags.push({ tagId: tag.id, pointId });
}

// A store with one tagged job, one job holding two points of which one is
// tagged, and one job the words do not reach.
function aStore() {
  const store = emptyStore();
  const backend = aTag(store, "Backend");
  const design = aTag(store, "Design");

  const platform = aRecord({ kind: "experience", title: "Platform lead", sortKey: "a0" });
  const tooling = aRecord({ kind: "experience", title: "Tooling", sortKey: "a1" });
  const studio = aRecord({ kind: "experience", title: "Studio", sortKey: "a2" });
  store.records.push(platform, tooling, studio);

  const queues = aPoint(store, "Cut queue latency", { recordId: platform.id, sortKey: "a0" });
  const rewrite = aPoint(store, "Rewrote the runner", { recordId: tooling.id, sortKey: "a0" });
  const brand = aPoint(store, "Redrew the marks", { recordId: tooling.id, sortKey: "a1" });
  aPoint(store, "Nothing to do with it", { recordId: studio.id, sortKey: "a0" });

  tagRecord(store, platform.id, backend);
  tagPoint(store, rewrite.id, backend);
  tagPoint(store, brand.id, design);

  const profile = aRoleProfile(store, "Backend", [backend]);
  const resume = aResume(store, "Staff engineer");
  return { store, profile, resume, backend, platform, tooling, studio, queues, rewrite, brand };
}

describe("roleProfileMatch", () => {
  it("takes the whole of a tagged record and only the tagged points of one that is not", () => {
    const { store, profile, platform, tooling, queues, rewrite } = aStore();
    const match = roleProfileMatch(store, profile.id);

    expect(match?.entries.map((entry) => entry.record.id)).toEqual([platform.id, tooling.id]);
    expect(match?.entries[0]?.points.map((point) => point.id)).toEqual([queues.id]);
    // The design point is under the same record and is not selected by it.
    expect(match?.entries[1]?.points.map((point) => point.id)).toEqual([rewrite.id]);
    expect(match?.points).toBe(2);
  });

  it("keeps a tagged record with no points at all", () => {
    const store = emptyStore();
    const backend = aTag(store, "Backend");
    const skill = aRecord({ kind: "skill", title: "Go", category: null, proficiency: null });
    store.records.push(skill);
    tagRecord(store, skill.id, backend);
    const profile = aRoleProfile(store, "Backend", [backend]);

    const match = roleProfileMatch(store, profile.id);
    expect(match?.entries).toEqual([{ record: skill, points: [] }]);
    expect(match?.points).toBe(0);
  });

  it("selects nothing for a profile with no words in it", () => {
    const { store } = aStore();
    const empty = aRoleProfile(store, "Nothing yet", [], { sortKey: "a1" });
    expect(roleProfileMatch(store, empty.id)).toMatchObject({ tags: [], entries: [], points: 0 });
  });

  it("answers nothing for a profile that does not exist", () => {
    const { store, resume } = aStore();
    expect(roleProfileMatch(store, resume.id)).toBeUndefined();
  });
});

describe("roleProfilePlan", () => {
  it("places what the words select on a resume holding nothing", () => {
    const { store, profile, resume, platform, tooling } = aStore();
    const plan = roleProfilePlan(store, resume.id, profile.id);
    if (plan === undefined) throw new Error("a plan");

    // One section for the kind both records are, and no second one.
    expect(plan.addSections).toHaveLength(1);
    expect(plan.addSections[0]?.kind).toBe("experience");
    expect(plan.addEntries.map((entry) => entry.recordId)).toEqual([platform.id, tooling.id]);
    expect(plan.addEntryPoints).toHaveLength(2);
    expect(roleProfileAdds(plan)).toEqual({ entries: 2, points: 2 });
  });

  it("writes nothing the second time", () => {
    const { store, profile, resume, platform, queues } = aStore();
    const section = aSection(store, resume.id, "experience");
    const entry = anEntry(store, section, platform.id);
    anEntryPoint(store, entry, queues);

    const plan = roleProfilePlan(store, resume.id, profile.id);
    if (plan === undefined) throw new Error("a plan");
    // The tooling record and its one point are still new; the platform entry
    // and the point already on the resume are left exactly as they are.
    expect(plan.addSections).toEqual([]);
    expect(plan.sections).toEqual([]);
    expect(plan.entries).toEqual([]);
    expect(plan.addEntries).toHaveLength(1);
    expect(plan.entryPoints).toEqual([]);
    expect(plan.addEntryPoints).toHaveLength(1);
  });

  it("turns back on what the resume had toggled off rather than adding a second row", () => {
    const { store, profile, resume, platform, queues } = aStore();
    const section = aSection(store, resume.id, "experience", { isVisible: false });
    const entry = anEntry(store, section, platform.id, { isVisible: false });
    const entryPoint = anEntryPoint(store, entry, queues, { isVisible: false });

    const plan = roleProfilePlan(store, resume.id, profile.id);
    expect(plan?.sections).toEqual([
      {
        id: section.id,
        patch: { isVisible: true },
        expectedUpdatedAt: section.updatedAt,
        unarchive: false,
      },
    ]);
    expect(plan?.entries[0]?.id).toBe(entry.id);
    expect(plan?.entryPoints[0]?.id).toBe(entryPoint.id);
    expect(plan?.addEntryPoints.map((row) => row.pointId)).not.toContain(queues.id);
  });

  it("puts an archived row back rather than writing over the index that covers it", () => {
    const { store, profile, resume, platform } = aStore();
    const section = aSection(store, resume.id, "experience", {
      archivedAt: "2026-02-01T00:00:00.000Z",
    });
    anEntry(store, section, platform.id, { archivedAt: "2026-02-01T00:00:00.000Z" });

    const plan = roleProfilePlan(store, resume.id, profile.id);
    expect(plan?.addSections).toEqual([]);
    expect(plan?.sections[0]).toMatchObject({ id: section.id, unarchive: true });
    expect(plan?.entries[0]).toMatchObject({ unarchive: true });
  });

  // I13: one row per point per resume, so a point placed under another entry is
  // turned back on where it is rather than moved.
  it("leaves a point placed elsewhere in the resume where it is", () => {
    const { store, profile, resume, studio, rewrite } = aStore();
    const other = aSection(store, resume.id, "experience");
    const entry = anEntry(store, other, studio.id);
    const stranded = anEntryPoint(store, entry, rewrite, { isVisible: false });

    const plan = roleProfilePlan(store, resume.id, profile.id);
    expect(plan?.entryPoints.map((row) => row.id)).toContain(stranded.id);
    expect(plan?.addEntryPoints.map((row) => row.pointId)).not.toContain(rewrite.id);
  });

  it("answers nothing for a resume that does not exist", () => {
    const { store, profile } = aStore();
    expect(roleProfilePlan(store, profile.id, profile.id)).toBeUndefined();
  });
});
