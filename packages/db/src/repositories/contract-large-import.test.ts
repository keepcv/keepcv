import { ConstraintViolationError, newUuid, StoreNotEmptyError } from "@keepcv/core";
import { describe, expect, it } from "vitest";
import { eachDriver } from "./contract.harness.js";
import { withPoints } from "./large-archive.harness.js";

eachDriver(({ run, otherOwner }) => {
  describe("large native archives", { timeout: 60_000 }, () => {
    it("restores 3000 Points and all 9000 Revisions with canonical and current pointers into concurrent owners", async () => {
      const archive = withPoints(await run((r) => r.store.read()), 3000);
      const other = await otherOwner();
      await Promise.all([run((r) => r.store.load(archive)), other((r) => r.store.load(archive))]);
      const exported = await run((r) => r.store.read());
      expect(exported.points).toHaveLength(3000);
      expect(exported.phrasingRevisions).toHaveLength(9000);
      expect(await other((r) => r.store.read())).toEqual(exported);
      expect(new Set(exported.phrasingRevisions.map((row) => row.id))).toEqual(
        new Set(archive.phrasingRevisions.map((row) => row.id)),
      );
      expect(exported.phrasings).toEqual(archive.phrasings);
      expect(exported.phrasingSets).toEqual(archive.phrasingSets);
      const first = exported.phrasings[0];
      if (first === undefined) throw new Error("Archive has phrasings");
      await run((r) => r.phrasings.addRevision(first.id, [{ t: "text", v: "Only one owner" }]));
      expect(await other((r) => r.store.read())).toEqual(exported);
      await expect(other((r) => r.store.load(archive))).rejects.toBeInstanceOf(StoreNotEmptyError);
    });

    it.each(["later batch", "later table"])(
      "rolls back every earlier imported row and the placeholder profile after a failure in a %s",
      async (when) => {
        const before = await run((r) => r.store.read());
        const archive = withPoints(before, 3000);
        if (when === "later batch") {
          const last = archive.phrasingRevisions.at(-1);
          const first = archive.phrasingRevisions[0];
          if (last === undefined || first === undefined) throw new Error("Archive has revisions");
          last.id = first.id;
        } else {
          const first = archive.points[0];
          if (first === undefined) throw new Error("Archive has Points");
          first.recordId = newUuid();
          archive.profile.fullName = "Imported profile must roll back";
        }
        const other = await otherOwner();
        const otherProfile = await other((r) => r.profile.get());
        await other((r) =>
          r.profile.update({ fullName: "Other owner kept intact" }, otherProfile.updatedAt),
        );
        const unaffected = await other((r) => r.store.read());
        const error = await run((r) => r.store.load(archive)).catch((error) => error as unknown);
        expect(error).toBeInstanceOf(ConstraintViolationError);
        expect((error as ConstraintViolationError).constraint).toBe(
          when === "later batch" ? "phrasing_revision_owner_id_id_pk" : "point_record_fk",
        );
        expect(await run((r) => r.store.read())).toEqual(before);
        expect(await other((r) => r.store.read())).toEqual(unaffected);
      },
    );
  });
});
