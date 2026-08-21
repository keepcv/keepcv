import { CAREER_RECORD_KINDS, type Store } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { newUuid } from "../identity/uuid.js";
import {
  aContactChannel,
  aField,
  aLink,
  aMetric,
  anEntry,
  anEntryPoint,
  anOrganisation,
  aPhrasingSet,
  aPoint,
  aRecord,
  aResume,
  aSection,
  aTag,
  EPOCH,
  emptyStore,
} from "../store/store.harness.js";
import { captureManifest } from "./capture.js";
import { compile } from "./compile.js";
import { PRESENTED_KINDS } from "./presenters.js";

const AT = "2026-08-17T09:00:00.000Z";

function aComposedStore() {
  const store = emptyStore();
  const acme = anOrganisation("Acme", { website: "https://acme.example", location: "London" });
  store.organisations.push(acme);

  const role = aRecord({
    kind: "experience",
    title: "Staff Engineer",
    subtitle: "Ingest",
    organisationId: acme.id,
    startedOn: "2024-03",
    isCurrent: true,
    employmentType: "Full-time",
    mode: "remote",
  });
  store.records.push(role);

  const resume = aResume(store, "Backend, Acme");
  const section = aSection(store, resume.id, "experience", { sortKey: "a0" });
  const entry = anEntry(store, section, role.id, { sortKey: "a0" });

  const point = aPoint(store, "Cut p95 latency from 800ms to 120ms", { recordId: role.id });
  anEntryPoint(store, entry, point, { sortKey: "a0" });

  return { store, resume, section, entry, role, point, acme };
}

describe("compile", () => {
  it("answers with nothing for a resume that is not in the store", () => {
    expect(compile(emptyStore(), newUuid(), { generatedAt: AT })).toBeUndefined();
  });

  // Pinned like the wording is: a template swapped in June must not change how
  // a version captured in March prints.
  it("names the template the resume chose, and carries it through the manifest", () => {
    const { store, resume } = aComposedStore();
    resume.templateId = "ats-single-column";
    resume.templateConfig = { pageSize: "letter" };

    const manifest = captureManifest(store, resume.id);
    expect(manifest?.template).toEqual({
      id: "ats-single-column",
      config: { pageSize: "letter" },
    });

    const doc = compile(store, resume.id, { generatedAt: AT });
    expect(doc?.meta.templateId).toBe("ats-single-column");
    expect(doc?.meta.templateConfig).toEqual({ pageSize: "letter" });
  });

  it("names no template when the resume chose none", () => {
    const { store, resume } = aComposedStore();
    const doc = compile(store, resume.id, { generatedAt: AT });

    expect(doc?.meta.templateId).toBeUndefined();
    expect(doc?.meta.templateConfig).toBeUndefined();
  });

  it("resolves a resume into a document a template can render", () => {
    const { store, resume } = aComposedStore();
    store.profile.fullName = "Ada Lovelace";
    store.profile.headline = "Backend engineer";
    aContactChannel(store, "email", "ada@example.com");

    const doc = compile(store, resume.id, { generatedAt: AT });

    expect(doc?.schemaVersion).toBe(1);
    expect(doc?.meta).toEqual({ generatedAt: AT, resumeName: "Backend, Acme", locale: "en-GB" });
    expect(doc?.header.fullName).toBe("Ada Lovelace");
    expect(doc?.header.contacts).toEqual([
      { key: "c0", kind: "email", value: "ada@example.com", href: "mailto:ada@example.com" },
    ]);

    const [section] = doc?.sections ?? [];
    expect(section).toMatchObject({ key: "s0", kind: "experience", heading: "Experience" });
    expect(section?.entries[0]).toMatchObject({
      key: "s0e0",
      kind: "experience",
      title: "Staff Engineer",
      subtitle: "Ingest",
      mode: "Remote",
      organisation: { name: "Acme", url: "https://acme.example", location: "London" },
      period: { start: "2024-03", isCurrent: true, display: "Mar 2024 - Present" },
    });
    expect(section?.entries[0]?.points[0]).toMatchObject({
      key: "s0e0p0",
      plainText: "Cut p95 latency from 800ms to 120ms",
    });
  });

  // I5 is structural - the type has no field evidence could travel in - so what
  // a test can check is that nothing else leaks either.
  it("carries no store identifier", () => {
    const { store, resume, role, point } = aComposedStore();
    const doc = compile(store, resume.id, { generatedAt: AT });

    const serialised = JSON.stringify(doc);
    for (const id of [resume.id, role.id, point.id, store.profile.id]) {
      expect(serialised).not.toContain(id);
    }
  });

  it("leaves out what is hidden, archived or unresolvable", () => {
    const { store, resume, entry, section } = aComposedStore();
    Object.assign(entry, { isVisible: false });
    expect(compile(store, resume.id, { generatedAt: AT })?.sections[0]?.entries).toEqual([]);

    Object.assign(entry, { isVisible: true });
    Object.assign(section, { isVisible: false });
    expect(compile(store, resume.id, { generatedAt: AT })?.sections).toEqual([]);
  });

  // Archiving a record leaves it on the resume with its phrasing choice intact
  // (data-model.md #9.1); what it must not do is print.
  it("leaves out an archived record, and a hidden or archived point", () => {
    const { store, resume, role, point } = aComposedStore();
    const [placed] = store.resumeEntryPoints;

    Object.assign(placed ?? {}, { isVisible: false });
    expect(compile(store, resume.id, { generatedAt: AT })?.sections[0]?.entries[0]?.points).toEqual(
      [],
    );

    Object.assign(placed ?? {}, { isVisible: true });
    Object.assign(point, { archivedAt: EPOCH });
    expect(compile(store, resume.id, { generatedAt: AT })?.sections[0]?.entries[0]?.points).toEqual(
      [],
    );

    Object.assign(role, { archivedAt: EPOCH });
    expect(compile(store, resume.id, { generatedAt: AT })?.sections[0]?.entries).toEqual([]);
  });

  it("leaves out an archived link and an archived field", () => {
    const { store, resume, role } = aComposedStore();
    aLink(store, role.id, { archivedAt: EPOCH });
    aField(store, role.id, "team-size", { archivedAt: EPOCH });

    const entry = compile(store, resume.id, { generatedAt: AT })?.sections[0]?.entries[0];
    expect(entry?.links).toEqual([]);
    expect(entry?.fields.map((field) => field.key)).toEqual(["employmentType"]);
  });

  it("gives a contact an href only where one would resolve", () => {
    const { store, resume } = aComposedStore();
    aContactChannel(store, "github", "github.com/ada", { sortKey: "a0" });
    aContactChannel(store, "location", "London", { sortKey: "a1" });
    aContactChannel(store, "other", "Ask me", { sortKey: "a2" });

    const contacts = compile(store, resume.id, { generatedAt: AT })?.header.contacts;
    expect(contacts?.map((contact) => contact.href)).toEqual([
      "https://github.com/ada",
      undefined,
      undefined,
    ]);
  });

  it("drops a point whose wording it cannot resolve rather than emitting an empty one", () => {
    const { store, resume } = aComposedStore();
    store.phrasingRevisions = [];

    expect(compile(store, resume.id, { generatedAt: AT })?.sections[0]?.entries[0]?.points).toEqual(
      [],
    );
  });

  it("formats metrics and orders them by sort key", () => {
    const { store, resume, point } = aComposedStore();
    store.metrics.push(
      aMetric(point.id, { label: "Cost", value: 40, unit: "%", sortKey: "a1" }),
      aMetric(point.id, { label: "Latency", value: 120, unit: "ms", baseline: 800 }),
    );

    const metrics = compile(store, resume.id, { generatedAt: AT })?.sections[0]?.entries[0]
      ?.points[0]?.metrics;
    expect(metrics?.map((metric) => metric.display)).toEqual(["800ms -> 120ms", "40%"]);
    expect(metrics?.map((metric) => metric.key)).toEqual(["s0e0p0m0", "s0e0p0m1"]);
  });

  it("carries tags as labels, sorted, and never their ids", () => {
    const { store, resume, role, point } = aComposedStore();
    const python = aTag(store, "Python");
    const golang = aTag(store, "Go");
    store.recordTags.push({ recordId: role.id, tagId: python.id });
    store.pointTags.push({ pointId: point.id, tagId: golang.id });

    const entry = compile(store, resume.id, { generatedAt: AT })?.sections[0]?.entries[0];
    expect(entry?.tags).toEqual(["Python"]);
    expect(entry?.points[0]?.tags).toEqual(["Go"]);
  });

  it("carries a record's links, and its fields beside the presenter's", () => {
    const { store, resume, role } = aComposedStore();
    aLink(store, role.id, { label: "Repository" });
    aField(store, role.id, "team-size", { label: "Team size", value: "6", valueKind: "number" });

    const entry = compile(store, resume.id, { generatedAt: AT })?.sections[0]?.entries[0];
    expect(entry?.links).toEqual([
      { key: "s0e0l0", kind: "repo", label: "Repository", url: "https://example.com/engine" },
    ]);
    expect(entry?.fields).toEqual([
      { key: "employmentType", label: "Employment type", value: "Full-time", kind: "text" },
      { key: "team-size", label: "Team size", value: "6", kind: "number" },
    ]);
  });

  // The presenter owns the canonical key; the user's value is still rendered
  // (template-model.md #3).
  it("suffixes a user field whose key collides with a presenter's", () => {
    const { store, resume, role } = aComposedStore();
    aField(store, role.id, "employmentType", { label: "Employment Type", value: "Contract" });

    const fields = compile(store, resume.id, { generatedAt: AT })?.sections[0]?.entries[0]?.fields;
    expect(fields).toEqual([
      { key: "employmentType", label: "Employment type", value: "Full-time", kind: "text" },
      { key: "employmentType-user", label: "Employment Type", value: "Contract", kind: "text" },
    ]);
  });

  it("resolves a heading from the section, its custom section, then the kind", () => {
    const { store, resume, section } = aComposedStore();
    expect(compile(store, resume.id, { generatedAt: AT })?.sections[0]?.heading).toBe("Experience");

    Object.assign(section, { heading: "Where I have worked" });
    expect(compile(store, resume.id, { generatedAt: AT })?.sections[0]?.heading).toBe(
      "Where I have worked",
    );
  });

  it("honours a per-resume contact override in both directions", () => {
    const { store, resume } = aComposedStore();
    const shown = aContactChannel(store, "email", "ada@example.com");
    const hidden = aContactChannel(store, "phone", "+44 7700 900000", {
      isDefaultVisible: false,
      sortKey: "a1",
    });
    store.resumeContactChannels.push(
      { resumeId: resume.id, contactChannelId: shown.id, isVisible: false },
      { resumeId: resume.id, contactChannelId: hidden.id, isVisible: true },
    );

    const contacts = compile(store, resume.id, { generatedAt: AT })?.header.contacts;
    expect(contacts?.map((contact) => contact.kind)).toEqual(["phone"]);
    expect(contacts?.[0]?.href).toBe("tel:+447700900000");
  });

  it("groups by organisation only where the layout hint asks for it", () => {
    const { store, resume, section, acme } = aComposedStore();
    const second = aRecord({
      kind: "experience",
      title: "Senior Engineer",
      organisationId: acme.id,
      startedOn: "2022-01",
      endedOn: "2024-02",
    });
    store.records.push(second);
    anEntry(store, section, second.id, { sortKey: "a1" });

    expect(compile(store, resume.id, { generatedAt: AT })?.sections[0]?.groups).toBeUndefined();

    Object.assign(section, { layout: "grouped" });
    const [group] = compile(store, resume.id, { generatedAt: AT })?.sections[0]?.groups ?? [];
    expect(group).toMatchObject({ key: "s0g0", title: "Acme", subtitle: "London" });
    expect(group?.entryKeys).toEqual(["s0e0", "s0e1"]);
    expect(group?.period?.display).toBe("Jan 2022 - Present");
  });

  it("carries the profile summary and an entry's own", () => {
    const { store, resume, role } = aComposedStore();
    store.profile.summarySetId = aPhrasingSet(store, "profile_summary", "Backend, ten years");
    Object.assign(role, {
      summarySetId: aPhrasingSet(store, "record_summary", "Owned the ingest pipeline"),
    });

    const doc = compile(store, resume.id, { generatedAt: AT });
    expect(doc?.header.summary).toEqual([{ t: "text", v: "Backend, ten years" }]);
    expect(doc?.sections[0]?.entries[0]?.summary).toEqual([
      { t: "text", v: "Owned the ingest pipeline" },
    ]);
  });

  it("formats a date the way the locale asks", () => {
    const { store, resume } = aComposedStore();
    const period = compile(store, resume.id, { generatedAt: AT, locale: "de-DE" })?.sections[0]
      ?.entries[0]?.period;
    expect(period?.display).toBe("M\u00e4rz 2024 - Present");
  });
});

describe("presenters", () => {
  // I14. A kind with no presenter is a kind that cannot reach a page.
  it("cover every record kind, and no other", () => {
    expect([...PRESENTED_KINDS].sort()).toEqual([...CAREER_RECORD_KINDS].sort());
  });

  function documentFor(record: Record<string, unknown>): Store {
    const store = emptyStore();
    const made = aRecord(record);
    store.records.push(made);
    const resume = aResume(store, "One");
    const section = aSection(store, resume.id, "project", { sortKey: "a0" });
    anEntry(store, section, made.id, { sortKey: "a0" });
    return store;
  }

  it("puts a certification's credential and expiry in fields, formatted", () => {
    const store = documentFor({
      kind: "certification",
      title: "AWS Solutions Architect",
      credentialId: "AWS-1234",
      expiresOn: "2027-03",
    });
    const resume = store.resumes[0];
    const fields = compile(store, resume?.id ?? newUuid(), { generatedAt: AT })?.sections[0]
      ?.entries[0]?.fields;

    expect(fields).toEqual([
      { key: "credentialId", label: "Credential ID", value: "AWS-1234", kind: "text" },
      { key: "expiresOn", label: "Expires", value: "Mar 2027", kind: "date" },
    ]);
  });

  it("reads a skill's proficiency as its subtitle and its category as a field", () => {
    const store = documentFor({
      kind: "skill",
      title: "TypeScript",
      category: "Languages",
      proficiency: "expert",
    });
    const entry = compile(store, store.resumes[0]?.id ?? newUuid(), { generatedAt: AT })
      ?.sections[0]?.entries[0];

    expect(entry).toMatchObject({ title: "TypeScript", subtitle: "Expert" });
    expect(entry?.fields).toEqual([
      { key: "category", label: "Category", value: "Languages", kind: "text" },
    ]);
  });

  it("gives a language no period, however the record was filled in", () => {
    const store = documentFor({
      kind: "language",
      title: "German",
      proficiency: "C1",
      startedOn: "2010",
    });
    const entry = compile(store, store.resumes[0]?.id ?? newUuid(), { generatedAt: AT })
      ?.sections[0]?.entries[0];

    expect(entry?.subtitle).toBe("C1");
    expect(entry?.period).toBeUndefined();
  });

  it("joins a grade to its scale", () => {
    const store = documentFor({
      kind: "education",
      title: "BSc Computer Science",
      grade: "First",
      gradeScale: "UK",
      thesisTitle: "On engines",
      honours: null,
    });
    const fields = compile(store, store.resumes[0]?.id ?? newUuid(), { generatedAt: AT })
      ?.sections[0]?.entries[0]?.fields;

    expect(fields).toEqual([
      { key: "grade", label: "Grade", value: "First (UK)", kind: "text" },
      { key: "thesisTitle", label: "Thesis", value: "On engines", kind: "text" },
    ]);
  });
});
