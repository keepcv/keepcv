import { captureManifest, newUuid } from "@keepcv/core";
import { CAREER_RECORD_KINDS } from "@keepcv/schema";
import {
  channelInput,
  customSectionInput,
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

export async function fill(run: Run): Promise<void> {
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
    // What a restore writes: the older manifest again, saying where it came
    // from.
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
