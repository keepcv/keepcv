import { captureManifest, newUuid, StoreNotEmptyError } from "@keepcv/core";
import {
  type Archive,
  CAREER_RECORD_KINDS,
  CURRENT_SCHEMA_VERSION,
  exportDocumentSchema,
  migrateDocument,
} from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import {
  channelInput,
  customSectionInput,
  eachDriver,
  entryInput,
  entryPointInput,
  evidenceInput,
  fieldInput,
  linkInput,
  metricInput,
  newPhrasing,
  organisationInput,
  parentSection,
  phrasingInput,
  phrasingSetInput,
  pointInput,
  type Run,
  recordInput,
  resumeInput,
  roleProfileInput,
  savedFilterInput,
  sectionInput,
  tagInput,
} from "./contract.harness.js";

// Everything the format can carry: every kind, both halves of every nullable
// pair, archived rows, markup, history, and a name no ASCII round trip survives.
async function fill(run: Run): Promise<void> {
  await run(async (r) => {
    const summary = await r.phrasings.createSet(
      phrasingSetInput(
        "profile_summary",
        newPhrasing("a0", "Designs engines that outlive their authors"),
      ),
    );
    const roleSummary = await r.phrasings.createSet(
      phrasingSetInput("record_summary", newPhrasing("a0", "Ran the engine team")),
    );
    const retired = await r.phrasings.createSet(
      phrasingSetInput("point", newPhrasing("a0", "Kept for later")),
    );
    await r.phrasings.archiveSet(retired.id, retired.updatedAt);

    const angled = await r.phrasings.create(
      phrasingInput(summary.id, "a1", "Platform-focused framing", {
        variant: "angled",
        label: "for platform roles",
      }),
    );
    const dropped = await r.phrasings.create(
      phrasingInput(summary.id, "a2", "An older framing", { variant: "short" }),
    );
    await r.phrasings.archive(dropped.id, dropped.updatedAt);

    await r.phrasings.addRevision(angled.id, [
      { t: "text", v: "Platform-focused framing, " },
      { t: "b", c: [{ t: "text", v: "rewritten" }] },
      { t: "a", href: "https://example.com/caf\u00e9", c: [{ t: "text", v: " with a link" }] },
    ]);

    const profile = await r.profile.get();
    await r.profile.update(
      {
        fullName: "Ada \u00c5berg",
        pronouns: "they/them",
        headline: "Engine designer",
        location: "London",
        summarySetId: summary.id,
      },
      profile.updatedAt,
    );

    await r.profile.createContactChannel(channelInput("a0"));
    const disused = await r.profile.createContactChannel(
      channelInput("a1", {
        kind: "phone",
        label: "Old",
        value: "+44 20 7946 0000",
        isDefaultVisible: false,
      }),
    );
    await r.profile.archiveContactChannel(disused.id, disused.updatedAt);

    const engines = await r.organisations.create(organisationInput("Analytical Engines"));
    const institute = await r.organisations.create(
      organisationInput("Zeta Institute", { kind: "institution" }),
    );
    await r.organisations.archive(institute.id, institute.updatedAt);

    const patents = await r.customSections.create(customSectionInput("Patents", "a0"));
    const press = await r.customSections.create(customSectionInput("Press", "a1"));
    await r.customSections.archive(press.id, press.updatedAt);

    for (const kind of CAREER_RECORD_KINDS) {
      await r.records.create(recordInput(kind, "a0", parentSection(kind, patents.id)));
    }
    const senior = await r.records.create(
      recordInput("experience", "a1", {
        organisationId: engines.id,
        subtitle: "Second role at one employer",
        startedOn: "2019",
        endedOn: "2020-06-01",
        isCurrent: true,
        location: "Remote",
        summarySetId: roleSummary.id,
      }),
    );
    const shelved = await r.records.create(recordInput("project", "a1"));
    await r.records.archive(shelved.id, shelved.updatedAt);

    await r.records.createLink(linkInput(senior.id, "a0"));
    const stale = await r.records.createLink(
      linkInput(senior.id, "a1", { kind: "verify", label: "Certificate" }),
    );
    await r.records.archiveLink(stale.id, stale.updatedAt);

    await r.records.createField(fieldInput(senior.id, "credentialId", "a0"));
    const superseded = await r.records.createField(
      fieldInput(senior.id, "team", "a1", { label: "Team", value: "Platform" }),
    );
    await r.records.archiveField(superseded.id, superseded.updatedAt);

    const placed = await r.points.create(
      pointInput(senior.id, "a0", "Cut p95 latency from 800ms to 120ms", {
        confidence: "verified",
        occurredOn: "2019-11-04",
      }),
    );
    const captured = await r.points.create(pointInput(null, "a0", "Somewhere, eventually"));
    const cut = await r.points.create(pointInput(senior.id, "a1", "A point that did not land"));
    await r.points.archive(cut.id, cut.updatedAt);
    await r.points.linkRecord(placed.id, shelved.id);
    await r.points.linkRecord(captured.id, senior.id);

    await r.points.createMetric(metricInput(placed.id, "a0"));
    const oldNumber = await r.points.createMetric(
      metricInput(placed.id, "a1", {
        label: "Cost",
        value: 0.125,
        unit: "%",
        baseline: null,
        direction: null,
        period: "per quarter",
      }),
    );
    await r.points.archiveMetric(oldNumber.id, oldNumber.updatedAt);

    await r.points.createEvidence(evidenceInput(placed.id));
    const staleNote = await r.points.createEvidence(
      evidenceInput(placed.id, {
        kind: "note",
        value: "Confirmed by the platform team",
        note: "from the incident review",
      }),
    );
    await r.points.archiveEvidence(staleNote.id, staleNote.updatedAt);

    const react = await r.tags.create(tagInput("React", { category: "skill" }));
    const merged = await r.tags.create(tagInput("Preact"));
    await r.tags.merge(merged.id, react.id, merged.updatedAt);
    await r.tags.tagRecord(senior.id, react.id);
    await r.tags.tagPoint(placed.id, react.id);

    // One per subject, one carrying a tag, and one archived: the covering test
    // below asserts every collection has a live row and an archived one.
    await r.savedFilters.create(
      savedFilterInput("React work", {
        query: "engine",
        kind: "experience",
        tagId: react.id,
      }),
    );
    await r.savedFilters.create(
      savedFilterInput("Points with no metric", { subject: "point", unfinished: "unmeasured" }),
    );
    const droppedFilter = await r.savedFilters.create(
      savedFilterInput("One I stopped using", { archived: "only", sortKey: "a1" }),
    );
    await r.savedFilters.archive(droppedFilter.id, droppedFilter.updatedAt);

    const backend = await r.roleProfiles.create(roleProfileInput("Backend"));
    await r.roleProfiles.addTag(backend.id, react.id);
    const droppedProfile = await r.roleProfiles.create(
      roleProfileInput("One I stopped using", { sortKey: "a1" }),
    );
    await r.roleProfiles.archive(droppedProfile.id, droppedProfile.updatedAt);

    const navy = await r.templates.create({
      id: newUuid(),
      name: "Navy headings",
      spec: { settings: { accent: "navy", headingPlace: "beside" }, extraCss: ".kc-name { }" },
    });
    const droppedTemplate = await r.templates.create({
      id: newUuid(),
      name: "One I stopped using",
      spec: { settings: {}, extraCss: "" },
    });
    await r.templates.archive(droppedTemplate.id, droppedTemplate.updatedAt);

    await r.drafts.save(
      { targetKind: "phrasing", targetId: angled.id, field: "text" },
      { body: [{ t: "text", v: "half a rewrite" }] },
    );
    await r.drafts.save(
      { targetKind: "record", targetId: senior.id, field: "title" },
      { value: "Staff Engineer" },
    );

    const applied = await r.resumes.create(
      resumeInput("For Acme", {
        templateId: "ats-single-column",
        templateConfig: { fontSize: 10.5, pageSize: "letter" },
        pageLimit: 1,
      }),
    );
    const shelvedResume = await r.resumes.create(
      resumeInput("An older draft", { templateId: navy.id }),
    );
    await r.resumes.archive(shelvedResume.id, shelvedResume.updatedAt);

    const experience = await r.resumes.addSection(sectionInput(applied.id, "experience", "a0"));
    const patentsSection = await r.resumes.addSection(
      sectionInput(applied.id, "custom", "a1", { customSectionId: patents.id }),
    );
    await r.resumes.archiveSection(patentsSection.id, patentsSection.updatedAt);

    const entry = await r.resumes.addEntry(entryInput(experience.id, applied.id, senior.id, "a0"));
    const droppedEntry = await r.resumes.addEntry(
      entryInput(experience.id, applied.id, shelved.id, "a1"),
    );
    await r.resumes.archiveEntry(droppedEntry.id, droppedEntry.updatedAt);

    const [firstPhrasing] = await r.phrasings.list({ phrasingSetId: placed.phrasingSetId });
    if (firstPhrasing !== undefined) {
      const chosen = await r.resumes.addEntryPoint(
        entryPointInput(entry.id, applied.id, placed.id, firstPhrasing.id, "a0"),
      );
      await r.resumes.archiveEntryPoint(chosen.id, chosen.updatedAt);
    }

    const [channel] = await r.profile.listContactChannels();
    if (channel !== undefined) {
      await r.resumes.setContactChannel(applied.id, channel.id, false);
    }

    const first = captureManifest(await r.store.readCurrent(), applied.id);
    if (first === undefined) throw new Error("the resume just written is not there");
    const sent = await r.versions.append({
      id: newUuid(),
      resumeId: applied.id,
      trigger: "export",
      restoredFromVersionId: null,
      manifest: first,
    });

    const renamed = await r.resumes.get(applied.id);
    await r.resumes.update(applied.id, { name: "For Acme, second pass" }, renamed.updatedAt);
    const second = captureManifest(await r.store.readCurrent(), applied.id);
    if (second === undefined) throw new Error("the resume just renamed is not there");
    const saved = await r.versions.append({
      id: newUuid(),
      resumeId: applied.id,
      trigger: "manual_save",
      restoredFromVersionId: null,
      manifest: second,
    });
    // What a restore writes: the older manifest again, saying where it came from.
    await r.versions.append({
      id: newUuid(),
      resumeId: applied.id,
      trigger: "restore",
      restoredFromVersionId: sent.version.id,
      manifest: first,
    });

    await r.versions.star({
      id: newUuid(),
      resumeVersionId: sent.version.id,
      label: "Sent to Acme, March",
      note: "the one they replied to",
    });
    const unstarred = await r.versions.star({
      id: newUuid(),
      resumeVersionId: saved.version.id,
      label: "A label that did not last",
      note: null,
    });
    await r.versions.archiveSnapshot(unstarred.id, unstarred.updatedAt);
  });
}

function reversed(store: Archive): Archive {
  return {
    profile: store.profile,
    contactChannels: [...store.contactChannels].reverse(),
    organisations: [...store.organisations].reverse(),
    customSections: [...store.customSections].reverse(),
    records: [...store.records].reverse(),
    recordLinks: [...store.recordLinks].reverse(),
    recordFields: [...store.recordFields].reverse(),
    phrasingSets: [...store.phrasingSets].reverse(),
    phrasings: [...store.phrasings].reverse(),
    phrasingRevisions: [...store.phrasingRevisions].reverse(),
    points: [...store.points].reverse(),
    pointRecordLinks: [...store.pointRecordLinks].reverse(),
    metrics: [...store.metrics].reverse(),
    evidence: [...store.evidence].reverse(),
    tags: [...store.tags].reverse(),
    recordTags: [...store.recordTags].reverse(),
    pointTags: [...store.pointTags].reverse(),
    drafts: [...store.drafts].reverse(),
    resumes: [...store.resumes].reverse(),
    resumeSections: [...store.resumeSections].reverse(),
    resumeEntries: [...store.resumeEntries].reverse(),
    resumeEntryPoints: [...store.resumeEntryPoints].reverse(),
    resumeContactChannels: [...store.resumeContactChannels].reverse(),
    savedFilters: [...store.savedFilters].reverse(),
    roleProfiles: [...store.roleProfiles].reverse(),
    roleProfileTags: [...store.roleProfileTags].reverse(),
    templates: [...store.templates].reverse(),
    resumeVersions: [...store.resumeVersions].reverse(),
    resumeSnapshots: [...store.resumeSnapshots].reverse(),
  };
}

// Every test here fills a whole store, reads it back through the file format and
// loads it into a second owner. That is past the default per-test budget when
// every package's suite runs at once: it timed out under `pnpm check` and passed
// on its own, which reads as a broken test.
const FILLS_A_WHOLE_STORE = 30_000;

eachDriver(({ run, otherOwner }) => {
  describe("export and import", { timeout: FILLS_A_WHOLE_STORE }, () => {
    // Through the file format, so anything surviving in memory but not on disk
    // fails here.
    it("restores a whole store into an empty one, unchanged", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());

      const document = exportDocumentSchema.parse({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        store: exported,
      });
      const reopened = migrateDocument(JSON.parse(JSON.stringify(document)));

      const other = await otherOwner();
      await other(async (r) => await r.store.load(reopened.store));

      expect(await other(async (r) => await r.store.read())).toEqual(exported);
    });

    // The property is only worth what the store it runs over covers, and a
    // collection nobody populated would pass every assertion below silently.
    it("covers every collection the format declares, archived rows included", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());

      for (const [collection, value] of Object.entries(exported)) {
        expect(Array.isArray(value) ? value.length : 1, collection).toBeGreaterThan(0);
      }
      expect(exported.records.map((entry) => entry.kind)).toEqual(
        expect.arrayContaining([...CAREER_RECORD_KINDS]),
      );
      // The collections with no `archivedAt`: revisions are immutable, a link or
      // an assignment holds nothing of its own, and a draft is discarded.
      const unarchivable = [
        "phrasingRevisions",
        "resumeVersions",
        "pointRecordLinks",
        "recordTags",
        "pointTags",
        "roleProfileTags",
        "drafts",
        "resumeContactChannels",
      ];
      for (const [collection, value] of Object.entries(exported)) {
        if (!Array.isArray(value) || unarchivable.includes(collection)) continue;
        expect(
          value.some((entry) => "archivedAt" in entry && entry.archivedAt !== null),
          collection,
        ).toBe(true);
      }
    });

    it("keeps the ids and timestamps the export carried", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());
      const other = await otherOwner();
      await other(async (r) => await r.store.load(exported));

      const restored = await other(async (r) => await r.records.list({ includeArchived: true }));
      const source = exported.records;
      expect(restored.map((entry) => entry.id)).toEqual(source.map((entry) => entry.id));
      expect(restored.map((entry) => entry.updatedAt)).toEqual(
        source.map((entry) => entry.updatedAt),
      );
    });

    // Identity is scoped to the owner, so the same export can live in two stores
    // at once - which is what restoring a backup onto a shared server does.
    it("leaves the store it was exported from alone", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());

      const other = await otherOwner();
      await other(async (r) => await r.store.load(exported));

      expect(await run(async (r) => await r.store.read())).toEqual(exported);
    });

    it("does not depend on the order the rows arrive in", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());

      const other = await otherOwner();
      await other(async (r) => await r.store.load(reversed(exported)));

      expect(await other(async (r) => await r.store.read())).toEqual(exported);
    });

    // I8: a file whose derived fields disagree with its body loads the projection.
    it("derives revision text from the body rather than trusting the document", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());
      const tampered = {
        ...exported,
        phrasingRevisions: exported.phrasingRevisions.map((revision) => ({
          ...revision,
          plainText: "not what the body says",
          charCount: 0,
        })),
      };

      const other = await otherOwner();
      await other(async (r) => await r.store.load(tampered));

      expect(await other(async (r) => await r.store.read())).toEqual(exported);
    });

    // I17, for the reason I8 is checked above.
    it("derives a tag's slug from its label rather than trusting the document", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());
      const tampered = {
        ...exported,
        tags: exported.tags.map((tag) => ({ ...tag, slug: "not-what-the-label-says" })),
      };

      const other = await otherOwner();
      await other(async (r) => await r.store.load(tampered));

      expect(await other(async (r) => await r.store.read())).toEqual(exported);
    });

    // The usage index is not in the file: it is derived, so a load that failed
    // to rebuild it would round-trip perfectly and answer nothing afterwards.
    it("rebuilds the usage index from the manifests it loaded", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());
      const printed = exported.resumeVersions[0]?.manifest.sections[0]?.entries[0]?.record.id;
      if (printed === undefined) throw new Error("the covering store prints no record");

      const other = await otherOwner();
      await other(async (r) => await r.store.load(exported));

      expect(await other(async (r) => await r.versions.usage("record", printed))).toEqual(
        await run(async (r) => await r.versions.usage("record", printed)),
      );
      expect(await run(async (r) => await r.versions.usage("record", printed))).not.toEqual([]);
    });

    it("round-trips a store with nothing in it", async () => {
      const exported = await run(async (r) => await r.store.read());
      const other = await otherOwner();
      await other(async (r) => await r.store.load(exported));

      expect(await other(async (r) => await r.store.read())).toEqual(exported);
    });

    // Stated as a difference, so a collection added to the format is covered here
    // without anyone remembering to extend a list.
    it("reads current state as the export with the superseded wordings dropped", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());
      const current = await run(async (r) => await r.store.readCurrent());

      const pointsAt = new Set(exported.phrasings.map((entry) => entry.currentRevisionId));
      const { resumeVersions, resumeSnapshots, ...store } = exported;
      expect(current).toEqual({
        ...store,
        phrasingRevisions: exported.phrasingRevisions.filter((entry) => pointsAt.has(entry.id)),
      });
      // History is the other difference, and it is absent rather than empty.
      expect(resumeVersions.length).toBeGreaterThan(0);
      expect(resumeSnapshots.length).toBeGreaterThan(0);
      // Otherwise the assertion above holds for a store that had no history to
      // drop, which is every store until somebody edits a wording twice.
      expect(current.phrasingRevisions.length).toBeLessThan(exported.phrasingRevisions.length);
    });

    // Two stores hold the same revision ids once a backup is restored beside its
    // original, and a join missing the owner would match across both.
    it("reads current state unchanged when another owner holds the same rows", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());
      const before = await run(async (r) => await r.store.readCurrent());

      const other = await otherOwner();
      await other(async (r) => await r.store.load(exported));

      expect(await run(async (r) => await r.store.readCurrent())).toEqual(before);
    });

    // "Where did my old entry go" is answered by a filter the client already has
    // the rows for, not by a second request.
    it("carries archived rows in current state too", async () => {
      await fill(run);
      const current = await run(async (r) => await r.store.readCurrent());

      expect(current.records.some((entry) => entry.archivedAt !== null)).toBe(true);
      expect(current.points.some((entry) => entry.archivedAt !== null)).toBe(true);
    });

    it("refuses to load over a store that already holds anything", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());
      const other = await otherOwner();
      await other(async (r) => await r.store.load(exported));

      const refusal = await other(async (r) => await r.store.load(exported)).then(
        () => undefined,
        (error: unknown) => error,
      );
      expect(refusal).toBeInstanceOf(StoreNotEmptyError);
      expect((refusal as StoreNotEmptyError).collection).toBe("contactChannels");
    });

    // The profile is the one row an empty store already has, so "empty" has to
    // mean the placeholder rather than merely "the row exists".
    it("refuses to load over a profile someone has filled in", async () => {
      const exported = await run(async (r) => await r.store.read());
      const other = await otherOwner();
      await other(async (r) => {
        const profile = await r.profile.get();
        await r.profile.update({ fullName: "Grace" }, profile.updatedAt);
      });

      await expect(other(async (r) => await r.store.load(exported))).rejects.toThrow(
        StoreNotEmptyError,
      );
      expect(await other(async (r) => await r.profile.get())).toMatchObject({ fullName: "Grace" });
    });
  });
});
