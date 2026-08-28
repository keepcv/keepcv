import { ConcurrencyConflictError, NotFoundError } from "@keepcv/core";
import { describe, expect, it } from "vitest";
import {
  eachDriver,
  roleProfileInput as profileInput,
  tagInput,
  violatedConstraint,
} from "./contract.harness.js";

eachDriver(({ run, otherOwner }) => {
  describe("role profiles", () => {
    it("keeps a named rule over the vocabulary", async () => {
      const created = await run(async (r) => await r.roleProfiles.create(profileInput("Backend")));
      expect(created).toMatchObject({ name: "Backend", sortKey: "a0", archivedAt: null });
    });

    it("orders by sort key, by code unit", async () => {
      await run(async (r) => {
        await r.roleProfiles.create(profileInput("second", { sortKey: "a1" }));
        await r.roleProfiles.create(profileInput("first", { sortKey: "Zz" }));
      });

      expect((await run(async (r) => await r.roleProfiles.list())).map((row) => row.name)).toEqual([
        "first",
        "second",
      ]);
    });

    // The pair is the whole row, so adding a word twice is one rule and taking
    // one out destroys nothing either end holds.
    it("adds and takes out a word, and adding twice is one rule", async () => {
      const { profile, tag } = await run(async (r) => ({
        profile: await r.roleProfiles.create(profileInput("Backend")),
        tag: await r.tags.create(tagInput("Go")),
      }));

      await run(async (r) => await r.roleProfiles.addTag(profile.id, tag.id));
      await run(async (r) => await r.roleProfiles.addTag(profile.id, tag.id));
      expect(await run(async (r) => await r.roleProfiles.listTags())).toEqual([
        { roleProfileId: profile.id, tagId: tag.id },
      ]);

      await run(async (r) => {
        await r.roleProfiles.removeTag(profile.id, tag.id);
      });
      expect(await run(async (r) => await r.roleProfiles.listTags())).toEqual([]);
      expect(await run(async (r) => await r.tags.get(tag.id))).toMatchObject({ label: "Go" });
    });

    it("refuses a tag another owner holds", async () => {
      const asIntruder = await otherOwner();
      const theirTag = await asIntruder(async (r) => await r.tags.create(tagInput("Theirs")));
      const profile = await run(async (r) => await r.roleProfiles.create(profileInput("Backend")));

      expect(
        await violatedConstraint(
          run(async (r) => await r.roleProfiles.addTag(profile.id, theirTag.id)),
        ),
      ).toBe("role_profile_tag_tag_fk");
    });

    // Archiving a tag is how a word is removed from the vocabulary, and a rule
    // naming it is not the thing that should stop that.
    it("keeps a rule naming a tag that has since been archived", async () => {
      const { profile, tag } = await run(async (r) => ({
        profile: await r.roleProfiles.create(profileInput("Backend")),
        tag: await r.tags.create(tagInput("Go")),
      }));
      await run(async (r) => await r.roleProfiles.addTag(profile.id, tag.id));
      await run(async (r) => await r.tags.archive(tag.id, tag.updatedAt));

      expect(await run(async (r) => await r.roleProfiles.listTags())).toHaveLength(1);
    });

    it("archives and puts back rather than deleting", async () => {
      const created = await run(async (r) => await r.roleProfiles.create(profileInput("Backend")));

      const archived = await run(
        async (r) => await r.roleProfiles.archive(created.id, created.updatedAt),
      );
      expect(await run(async (r) => await r.roleProfiles.list())).toEqual([]);
      expect(
        await run(async (r) => await r.roleProfiles.list({ includeArchived: true })),
      ).toHaveLength(1);

      const restored = await run(
        async (r) => await r.roleProfiles.restore(archived.id, archived.updatedAt),
      );
      expect(restored.archivedAt).toBeNull();
    });

    it("refuses a write against a stale token", async () => {
      const created = await run(async (r) => await r.roleProfiles.create(profileInput("Backend")));
      await run(
        async (r) =>
          await r.roleProfiles.update(created.id, { name: "Renamed" }, created.updatedAt),
      );

      await expect(
        run(async (r) => await r.roleProfiles.update(created.id, { name: "A" }, created.updatedAt)),
      ).rejects.toThrow(ConcurrencyConflictError);
    });

    it("cannot reach another owner's profile or the rules it holds", async () => {
      const asIntruder = await otherOwner();
      const theirs = await asIntruder(async (r) => {
        const profile = await r.roleProfiles.create(profileInput("T"));
        const tag = await r.tags.create(tagInput("Theirs"));
        await r.roleProfiles.addTag(profile.id, tag.id);
        return profile;
      });

      await expect(run(async (r) => await r.roleProfiles.get(theirs.id))).rejects.toThrow(
        NotFoundError,
      );
      await expect(
        run(async (r) => await r.roleProfiles.addTag(theirs.id, theirs.id)),
      ).rejects.toThrow(NotFoundError);
      expect(await run(async (r) => await r.roleProfiles.list())).toEqual([]);
      expect(await run(async (r) => await r.roleProfiles.listTags())).toEqual([]);
    });
  });
});
