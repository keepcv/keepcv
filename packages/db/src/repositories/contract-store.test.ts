import { StoreNotEmptyError } from "@keepcv/core";
import {
  type Archive,
  CAREER_RECORD_KINDS,
  CURRENT_SCHEMA_VERSION,
  exportDocumentSchema,
  migrateDocument,
} from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { eachDriver } from "./contract.harness.js";

import { fill } from "./contract-store.harness.js";

function reversed(store: Archive): Archive {
  return {
    profile: store.profile,
    agentHistory: [...store.agentHistory].reverse(),
    agentAttachments: [...store.agentAttachments].reverse(),
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

// A whole store through the file format is past the default per-test budget: it
// timed out under `pnpm check` and passed alone, which reads as a broken test.
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
      // The collections with no `archivedAt`: revisions are immutable, a link
      // or an assignment holds nothing of its own, and a draft is discarded.
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

    // Identity is scoped to the owner, so the same export can live in two
    // stores at once - which is what restoring a backup onto a shared server
    // does.
    it("leaves the store it was exported from alone", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());

      const other = await otherOwner();
      await other(async (r) => await r.store.load(exported));

      expect(await run(async (r) => await r.store.read())).toEqual(exported);
    });

    it("preserves older template CSS in a native archive without validating it as a new design", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());
      const design = exported.templates[0];
      if (design === undefined) throw new Error("the fixture must contain a design");
      if (!("extraCss" in design.spec)) throw new Error("expected a visual template fixture");
      design.spec.extraCss = '.kc-name { background: image-set("https://example.test/a" 1x); }';
      const other = await otherOwner();
      await other(async (r) => await r.store.load(exported));
      expect(await other(async (r) => await r.store.read())).toEqual(exported);
    });

    it("keeps unknown typed source and v1 history unchanged through migration and archive import", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());
      const design = exported.templates[0];
      if (design === undefined) throw new Error("The archive contains a template");
      const history = JSON.stringify(exported.resumeVersions);
      design.spec = {
        type: "latex",
        version: 3,
        payload: {
          entry: "main.tex",
          files: {
            "main.tex": { encoding: "utf8", content: "SOURCE" },
            "design.cls": { encoding: "utf8", content: "CLASS" },
          },
        },
      };
      const reopened = migrateDocument({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        store: exported,
      });
      expect(JSON.stringify(reopened.store.resumeVersions)).toBe(history);
      const other = await otherOwner();
      await other(async (r) => await r.store.load(reopened.store));
      expect(await other(async (r) => await r.store.read())).toEqual(exported);
    });

    it("round trips every HTML source and asset byte without a database migration", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());
      const design = exported.templates[0];
      if (design === undefined) throw new Error("The archive contains a template");
      design.spec = {
        type: "html",
        version: 1,
        payload: {
          documentVersions: [1],
          entry: "index.html",
          styles: ["theme.css"],
          page: { size: "letter", marginMm: 8 },
          files: {
            "index.html": {
              mediaType: "text/html",
              encoding: "utf8",
              content: "<h1>{{ resume.header.fullName }}</h1>",
            },
            "theme.css": { mediaType: "text/css", encoding: "utf8", content: "h1{color:navy}" },
            "assets/icon.png": {
              mediaType: "image/png",
              encoding: "base64",
              content: "iVBORw0KGgo=",
            },
          },
        },
      };
      const other = await otherOwner();
      await other(
        async (r) =>
          await r.store.load(
            migrateDocument({
              schemaVersion: CURRENT_SCHEMA_VERSION,
              exportedAt: new Date().toISOString(),
              store: exported,
            }).store,
          ),
      );
      expect(await other(async (r) => await r.store.read())).toEqual(exported);
      expect((await other(async (r) => await r.store.readCurrent())).templates).toEqual(
        exported.templates,
      );
    });

    it("does not depend on the order the rows arrive in", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());

      const other = await otherOwner();
      await other(async (r) => await r.store.load(reversed(exported)));

      expect(await other(async (r) => await r.store.read())).toEqual(exported);
    });

    // I8: a file whose derived fields disagree with its body loads the
    // projection.
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

    // Stated as a difference, so a collection added to the format is covered
    // here without anyone remembering to extend a list.
    it("reads current state as the export with the superseded wordings dropped", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());
      const current = await run(async (r) => await r.store.readCurrent());

      const pointsAt = new Set(exported.phrasings.map((entry) => entry.currentRevisionId));
      const { resumeVersions, resumeSnapshots, agentHistory, agentAttachments, ...store } =
        exported;
      expect(current).toEqual({
        ...store,
        agentConversations: agentHistory.map(({ messages, actions, run, ...summary }) => summary),
        phrasingRevisions: exported.phrasingRevisions.filter((entry) => pointsAt.has(entry.id)),
      });
      // History is the other difference, and it is absent rather than empty.
      expect(resumeVersions.length).toBeGreaterThan(0);
      expect(resumeSnapshots.length).toBeGreaterThan(0);
      // Otherwise the assertion above holds for a store that had no history to
      // drop, which is every store until somebody edits a wording twice.
      expect(current.phrasingRevisions.length).toBeLessThan(exported.phrasingRevisions.length);
    });

    // Two stores hold the same revision ids once a backup is restored beside
    // its original, and a join missing the owner would match across both.
    it("reads current state unchanged when another owner holds the same rows", async () => {
      await fill(run);
      const exported = await run(async (r) => await r.store.read());
      const before = await run(async (r) => await r.store.readCurrent());

      const other = await otherOwner();
      await other(async (r) => await r.store.load(exported));

      expect(await run(async (r) => await r.store.readCurrent())).toEqual(before);
    });

    // "Where did my old entry go" is answered by a filter the client already
    // has the rows for, not by a second request.
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
