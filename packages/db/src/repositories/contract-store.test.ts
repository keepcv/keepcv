import { StoreNotEmptyError } from "@keepcv/core";
import {
  CAREER_RECORD_KINDS,
  CURRENT_SCHEMA_VERSION,
  exportDocumentSchema,
  migrateDocument,
  type Store,
} from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import {
  channelInput,
  eachDriver,
  evidenceInput,
  fieldInput,
  linkInput,
  metricInput,
  newPhrasing,
  organisationInput,
  phrasingInput,
  phrasingSetInput,
  pointInput,
  type Run,
  recordInput,
} from "./contract.harness.js";

// Everything the format can carry: every record kind with its own columns, both
// halves of every nullable pair, archived rows beside live ones, all three
// partial-date precisions, wording with markup and more than one revision behind
// it, and a name no ASCII round trip survives.
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

    for (const kind of CAREER_RECORD_KINDS) {
      await r.records.create(recordInput(kind, "a0"));
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
  });
}

function reversed(store: Store): Store {
  return {
    profile: store.profile,
    contactChannels: [...store.contactChannels].reverse(),
    organisations: [...store.organisations].reverse(),
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
  };
}

eachDriver(({ run, otherOwner }) => {
  describe("export and import", () => {
    // Through the file format rather than the object it came from: an export is
    // JSON someone keeps, and `migrateDocument` is the only supported way back
    // in, so anything that survives in memory but not on disk fails here.
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
      // The two collections with no `archivedAt`: a revision is immutable, so a
      // superseded wording is superseded and never archived, and a point's record
      // link holds nothing of its own to archive.
      const unarchivable = ["phrasingRevisions", "pointRecordLinks"];
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

    // I8: a revision's plain text is derived from its body, so a file whose
    // derived fields disagree with the body it carries loads with the body's own
    // projection rather than the file's claim about it.
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

    it("round-trips a store with nothing in it", async () => {
      const exported = await run(async (r) => await r.store.read());
      const other = await otherOwner();
      await other(async (r) => await r.store.load(exported));

      expect(await other(async (r) => await r.store.read())).toEqual(exported);
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
