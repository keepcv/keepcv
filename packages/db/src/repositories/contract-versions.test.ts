import { ConcurrencyConflictError, captureManifest, NotFoundError, newUuid } from "@keepcv/core";
import type { ResumeManifest, Uuid } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import {
  compose,
  eachDriver,
  type Run,
  resumeInput,
  violatedConstraint,
} from "./contract.harness.js";

async function manifestOf(run: Run, resumeId: Uuid): Promise<ResumeManifest> {
  const manifest = await run(async (r) => captureManifest(await r.store.readCurrent(), resumeId));
  if (manifest === undefined) throw new Error(`resume ${resumeId} is not there`);
  return manifest;
}

async function append(
  run: Run,
  resumeId: Uuid,
  manifest: ResumeManifest,
  overrides: { trigger?: "export" | "manual_save" | "restore"; restoredFromVersionId?: Uuid } = {},
) {
  return await run(
    async (r) =>
      await r.versions.append({
        id: newUuid(),
        resumeId,
        trigger: overrides.trigger ?? "export",
        restoredFromVersionId: overrides.restoredFromVersionId ?? null,
        manifest,
      }),
  );
}

async function rename(run: Run, resumeId: Uuid, name: string): Promise<void> {
  await run(async (r) => {
    const resume = await r.resumes.get(resumeId);
    await r.resumes.update(resumeId, { name }, resume.updatedAt);
  });
}

eachDriver(({ run, otherOwner }) => {
  describe("resume versions", () => {
    it("numbers versions from one, per resume", async () => {
      const first = await compose(run, "For Acme");
      const second = await compose(run, "For Zeta", "a1");

      const a1 = await append(run, first.resumeId, await manifestOf(run, first.resumeId));
      await rename(run, first.resumeId, "For Acme, again");
      const a2 = await append(run, first.resumeId, await manifestOf(run, first.resumeId));
      const b1 = await append(run, second.resumeId, await manifestOf(run, second.resumeId));

      expect([a1.version.seq, a2.version.seq, b1.version.seq]).toEqual([1, 2, 1]);
    });

    // Three sends of one resume are three snapshots, not three timeline entries
    // nobody can tell apart (data-model.md #9.2).
    it("answers the current version when the manifest has not moved", async () => {
      const { resumeId } = await compose(run);
      const manifest = await manifestOf(run, resumeId);

      const first = await append(run, resumeId, manifest);
      const again = await append(run, resumeId, manifest, { trigger: "manual_save" });

      expect(again.created).toBe(false);
      expect(again.version.id).toBe(first.version.id);
      expect(again.version.trigger).toBe("export");
      expect(await run(async (r) => await r.versions.list({ resumeId }))).toHaveLength(1);
    });

    // Only against the current one: an older manifest coming back is a restore,
    // and the timeline has to record that it happened.
    it("appends when an earlier manifest is captured again", async () => {
      const { resumeId } = await compose(run);
      const original = await manifestOf(run, resumeId);
      const first = await append(run, resumeId, original);

      await rename(run, resumeId, "A different target");
      await append(run, resumeId, await manifestOf(run, resumeId));

      const restored = await append(run, resumeId, original, {
        trigger: "restore",
        restoredFromVersionId: first.version.id,
      });
      expect(restored.created).toBe(true);
      expect(restored.version.seq).toBe(3);
      expect(restored.version.manifestHash).toBe(first.version.manifestHash);
      expect(restored.version.restoredFromVersionId).toBe(first.version.id);
    });

    // A restore is an event rather than a state: landing on the manifest that is
    // already current still has to show, or pressing it appears to do nothing.
    it("appends a restore that lands on the current manifest", async () => {
      const { resumeId } = await compose(run);
      const manifest = await manifestOf(run, resumeId);
      const first = await append(run, resumeId, manifest);

      const again = await append(run, resumeId, manifest, {
        trigger: "restore",
        restoredFromVersionId: first.version.id,
      });

      expect(again.created).toBe(true);
      expect(again.version.seq).toBe(2);
      expect(again.version.manifestHash).toBe(first.version.manifestHash);
    });

    it("pins what the resume said, so later edits do not rewrite it", async () => {
      const { resumeId, recordId } = await compose(run);
      const version = await append(run, resumeId, await manifestOf(run, resumeId));

      await run(async (r) => {
        const record = await r.records.get(recordId);
        await r.records.update(
          recordId,
          { kind: "experience", title: "A title written later" },
          record.updatedAt,
        );
      });

      const stored = await run(async (r) => await r.versions.get(version.version.id));
      expect(stored.manifest.sections[0]?.entries[0]?.record.title).toBe("a experience");
    });

    it("refuses a version for a resume that is not there", async () => {
      const { resumeId } = await compose(run);
      const manifest = await manifestOf(run, resumeId);
      const stranger = resumeInput("Someone else's").id;

      await expect(append(run, stranger, manifest)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("keeps one owner's versions out of another's", async () => {
      const { resumeId } = await compose(run);
      const version = await append(run, resumeId, await manifestOf(run, resumeId));
      const intruder = await otherOwner();

      await expect(
        intruder(async (r) => await r.versions.get(version.version.id)),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(await intruder(async (r) => await r.versions.list())).toEqual([]);
    });
  });

  describe("the usage index", () => {
    it("answers which versions a point is printed in", async () => {
      const { resumeId, pointId, recordId } = await compose(run);
      const version = await append(run, resumeId, await manifestOf(run, resumeId));

      expect(await run(async (r) => await r.versions.usage("point", pointId))).toEqual([
        {
          resumeVersionId: version.version.id,
          resumeId,
          seq: 1,
          createdAt: version.version.createdAt,
        },
      ]);
      expect(await run(async (r) => await r.versions.usage("record", recordId))).toHaveLength(1);
    });

    it("answers nothing for a point no version pinned", async () => {
      const { resumeId, pointId } = await compose(run);
      await append(run, resumeId, await manifestOf(run, resumeId));
      const elsewhere = await compose(run, "Another resume", "a1");

      expect(await run(async (r) => await r.versions.usage("point", elsewhere.pointId))).toEqual(
        [],
      );
      expect(await run(async (r) => await r.versions.usage("contact_channel", pointId))).toEqual(
        [],
      );
    });

    // Two stores hold the same point ids once a backup is restored beside its
    // original, and a join missing the owner would match across both.
    it("keeps one owner's usage out of another's", async () => {
      const { resumeId, pointId } = await compose(run);
      await append(run, resumeId, await manifestOf(run, resumeId));
      const intruder = await otherOwner();

      expect(await intruder(async (r) => await r.versions.usage("point", pointId))).toEqual([]);
    });
  });

  describe("snapshots", () => {
    it("stars a version, and lists it under its resume", async () => {
      const { resumeId } = await compose(run);
      const version = await append(run, resumeId, await manifestOf(run, resumeId));

      const snapshot = await run(
        async (r) =>
          await r.versions.star({
            id: newUuid(),
            resumeVersionId: version.version.id,
            label: "Sent to Acme, March",
            note: null,
          }),
      );

      expect(await run(async (r) => await r.versions.listSnapshots({ resumeId }))).toEqual([
        snapshot,
      ]);
      const other = await compose(run, "Elsewhere", "a1");
      expect(
        await run(async (r) => await r.versions.listSnapshots({ resumeId: other.resumeId })),
      ).toEqual([]);
    });

    it("refuses a second snapshot of one version", async () => {
      const { resumeId } = await compose(run);
      const version = await append(run, resumeId, await manifestOf(run, resumeId));
      const star = async (label: string) =>
        await run(
          async (r) =>
            await r.versions.star({
              id: newUuid(),
              resumeVersionId: version.version.id,
              label,
              note: null,
            }),
        );

      await star("Sent to Acme, March");
      expect(await violatedConstraint(star("Sent again"))).toBe("resume_snapshot_version_unique");
    });

    it("refuses a snapshot of a version that is not there", async () => {
      await expect(
        run(
          async (r) =>
            await r.versions.star({
              id: newUuid(),
              resumeVersionId: newUuid(),
              label: "Of nothing",
              note: null,
            }),
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("unstars by archiving, and restores", async () => {
      const { resumeId } = await compose(run);
      const version = await append(run, resumeId, await manifestOf(run, resumeId));
      const snapshot = await run(
        async (r) =>
          await r.versions.star({
            id: newUuid(),
            resumeVersionId: version.version.id,
            label: "Sent to Acme, March",
            note: null,
          }),
      );

      const unstarred = await run(
        async (r) => await r.versions.archiveSnapshot(snapshot.id, snapshot.updatedAt),
      );
      expect(await run(async (r) => await r.versions.listSnapshots())).toEqual([]);
      expect(
        await run(async (r) => await r.versions.listSnapshots({ includeArchived: true })),
      ).toHaveLength(1);

      await run(async (r) => await r.versions.restoreSnapshot(unstarred.id, unstarred.updatedAt));
      expect(await run(async (r) => await r.versions.listSnapshots())).toHaveLength(1);
    });

    it("refuses a label written against a stale read", async () => {
      const { resumeId } = await compose(run);
      const version = await append(run, resumeId, await manifestOf(run, resumeId));
      const snapshot = await run(
        async (r) =>
          await r.versions.star({
            id: newUuid(),
            resumeVersionId: version.version.id,
            label: "Sent to Acme, March",
            note: null,
          }),
      );

      await run(
        async (r) =>
          await r.versions.updateSnapshot(snapshot.id, { label: "Renamed" }, snapshot.updatedAt),
      );

      await expect(
        run(
          async (r) =>
            await r.versions.updateSnapshot(
              snapshot.id,
              { note: "written against the old read" },
              snapshot.updatedAt,
            ),
        ),
      ).rejects.toBeInstanceOf(ConcurrencyConflictError);
      expect(await run(async (r) => await r.versions.getSnapshot(snapshot.id))).toMatchObject({
        label: "Renamed",
        note: null,
      });
    });
  });
});
