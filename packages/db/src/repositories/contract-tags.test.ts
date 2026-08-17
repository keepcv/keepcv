import {
  ConcurrencyConflictError,
  NotFoundError,
  newUuid,
  TagMergedIntoItselfError,
} from "@keepcv/core";
import { describe, expect, it } from "vitest";
import {
  eachDriver,
  pointInput,
  recordInput,
  tagInput,
  violatedConstraint,
} from "./contract.harness.js";

eachDriver(({ run, otherOwner }) => {
  describe("tags", () => {
    it("derives the slug from the label rather than taking one", async () => {
      const created = await run(async (r) => await r.tags.create(tagInput("Distributed Systems")));
      expect(created.slug).toBe("distributed-systems");
      expect(created.label).toBe("Distributed Systems");
    });

    // The point of the slug: two spellings of one word are one tag, and the
    // second attempt is refused rather than quietly making a duplicate.
    it("refuses a second tag whose label projects to the same slug", async () => {
      await run(async (r) => await r.tags.create(tagInput("React")));

      expect(
        await violatedConstraint(run(async (r) => await r.tags.create(tagInput("  react  ")))),
      ).toBe("tag_slug_unique");
    });

    it("lists by label and leaves archived tags out by default", async () => {
      const retired = await run(async (r) => {
        await r.tags.create(tagInput("React"));
        await r.tags.create(tagInput("Ansible"));
        return await r.tags.create(tagInput("Retired"));
      });
      await run(async (r) => await r.tags.archive(retired.id, retired.updatedAt));

      expect(await run(async (r) => (await r.tags.list()).map((tag) => tag.label))).toEqual([
        "Ansible",
        "React",
      ]);
      expect(
        await run(async (r) => (await r.tags.list({ includeArchived: true })).map((t) => t.label)),
      ).toEqual(["Ansible", "React", "Retired"]);
    });

    // The uniqueness index is partial for this: a word taken by something the
    // user has put away is a word they cannot use.
    it("frees the slug when a tag is archived, and takes it back on restore", async () => {
      const first = await run(async (r) => await r.tags.create(tagInput("React")));
      const archived = await run(async (r) => await r.tags.archive(first.id, first.updatedAt));
      const second = await run(async (r) => await r.tags.create(tagInput("React")));

      expect(second.slug).toBe("react");
      expect(
        await violatedConstraint(
          run(async (r) => await r.tags.restore(archived.id, archived.updatedAt)),
        ),
      ).toBe("tag_slug_unique");
    });

    it("renames the slug with the label", async () => {
      const tag = await run(async (r) => await r.tags.create(tagInput("Reakt")));
      const renamed = await run(
        async (r) => await r.tags.update(tag.id, { label: "React" }, tag.updatedAt),
      );

      expect(renamed).toMatchObject({ label: "React", slug: "react" });
    });

    // A patch that leaves the label alone leaves the slug alone: rewriting it
    // from a label nobody sent would be a rename the caller did not ask for.
    it("leaves the slug alone when only the category changes", async () => {
      const tag = await run(async (r) => await r.tags.create(tagInput("React")));
      const filed = await run(
        async (r) => await r.tags.update(tag.id, { category: "skill" }, tag.updatedAt),
      );

      expect(filed).toMatchObject({ slug: "react", category: "skill" });
    });

    it("refuses a rename based on a stale read", async () => {
      const tag = await run(async (r) => await r.tags.create(tagInput("React")));
      await run(async (r) => await r.tags.update(tag.id, { label: "React 19" }, tag.updatedAt));

      await expect(
        run(async (r) => await r.tags.update(tag.id, { label: "Preact" }, tag.updatedAt)),
      ).rejects.toBeInstanceOf(ConcurrencyConflictError);
    });

    it("cannot read another owner's tag", async () => {
      const asIntruder = await otherOwner();
      const theirs = await asIntruder(async (r) => await r.tags.create(tagInput("React")));

      await expect(run(async (r) => await r.tags.get(theirs.id))).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("tagging records and points", () => {
    it("tags both sides and reads each back", async () => {
      const { record, point, tag } = await run(async (r) => {
        const record = await r.records.create(recordInput("experience", "a0"));
        const point = await r.points.create(pointInput(record.id, "a0", "Words"));
        const tag = await r.tags.create(tagInput("React"));
        await r.tags.tagRecord(record.id, tag.id);
        await r.tags.tagPoint(point.id, tag.id);
        return { record, point, tag };
      });

      expect(await run(async (r) => await r.tags.listRecordTags({ recordId: record.id }))).toEqual([
        { tagId: tag.id, recordId: record.id },
      ]);
      expect(await run(async (r) => await r.tags.listPointTags({ tagId: tag.id }))).toEqual([
        { tagId: tag.id, pointId: point.id },
      ]);
    });

    // The pair is the whole row, so tagging twice has nothing to change.
    it("tags something twice without complaining", async () => {
      const { record, tag } = await run(async (r) => {
        const record = await r.records.create(recordInput("project", "a0"));
        const tag = await r.tags.create(tagInput("React"));
        await r.tags.tagRecord(record.id, tag.id);
        await r.tags.tagRecord(record.id, tag.id);
        return { record, tag };
      });

      expect(await run(async (r) => await r.tags.listRecordTags({ recordId: record.id }))).toEqual([
        { tagId: tag.id, recordId: record.id },
      ]);
    });

    it("untags what was never tagged, and refuses an unknown record", async () => {
      const tag = await run(async (r) => await r.tags.create(tagInput("React")));
      const record = await run(async (r) => await r.records.create(recordInput("project", "a0")));

      await run(async (r) => await r.tags.untagRecord(record.id, tag.id));
      await expect(
        run(async (r) => await r.tags.untagRecord(newUuid(), tag.id)),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("refuses a tag that does not exist", async () => {
      const record = await run(async (r) => await r.records.create(recordInput("project", "a0")));

      expect(
        await violatedConstraint(run(async (r) => await r.tags.tagRecord(record.id, newUuid()))),
      ).toBe("record_tag_tag_fk");
    });

    // The record is the subject, so one belonging to somebody else is a 404.
    it("cannot tag another owner's record or point", async () => {
      const asIntruder = await otherOwner();
      const theirs = await asIntruder(async (r) => {
        const record = await r.records.create(recordInput("project", "a0"));
        return { record, point: await r.points.create(pointInput(record.id, "a0", "Theirs")) };
      });
      const tag = await run(async (r) => await r.tags.create(tagInput("React")));

      await expect(
        run(async (r) => await r.tags.tagRecord(theirs.record.id, tag.id)),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        run(async (r) => await r.tags.tagPoint(theirs.point.id, tag.id)),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("takes a tag off without touching either end of it", async () => {
      const { record, tag } = await run(async (r) => {
        const record = await r.records.create(recordInput("project", "a0"));
        const tag = await r.tags.create(tagInput("React"));
        await r.tags.tagRecord(record.id, tag.id);
        await r.tags.untagRecord(record.id, tag.id);
        return { record, tag };
      });

      expect(await run(async (r) => await r.tags.listRecordTags())).toEqual([]);
      expect(await run(async (r) => await r.records.get(record.id))).toBeDefined();
      expect(await run(async (r) => await r.tags.get(tag.id))).toBeDefined();
    });
  });

  describe("merging tags", () => {
    it("moves everything onto the other tag and archives the one merged away", async () => {
      const { react, preact, record, point } = await run(async (r) => {
        const react = await r.tags.create(tagInput("React"));
        const preact = await r.tags.create(tagInput("Preact"));
        const record = await r.records.create(recordInput("project", "a0"));
        const point = await r.points.create(pointInput(record.id, "a0", "Words"));
        await r.tags.tagRecord(record.id, preact.id);
        await r.tags.tagPoint(point.id, preact.id);
        return { react, preact, record, point };
      });

      const merged = await run(
        async (r) => await r.tags.merge(preact.id, react.id, preact.updatedAt),
      );

      expect(merged.id).toBe(preact.id);
      expect(merged.archivedAt).not.toBeNull();
      expect(await run(async (r) => await r.tags.listRecordTags())).toEqual([
        { tagId: react.id, recordId: record.id },
      ]);
      expect(await run(async (r) => await r.tags.listPointTags())).toEqual([
        { tagId: react.id, pointId: point.id },
      ]);
    });

    // A record already carrying both would collide with itself, which is why the
    // assignments are inserted and deleted rather than repointed in place.
    it("leaves one assignment on a record that carried both tags", async () => {
      const { react, preact, record } = await run(async (r) => {
        const react = await r.tags.create(tagInput("React"));
        const preact = await r.tags.create(tagInput("Preact"));
        const record = await r.records.create(recordInput("project", "a0"));
        await r.tags.tagRecord(record.id, react.id);
        await r.tags.tagRecord(record.id, preact.id);
        return { react, preact, record };
      });

      await run(async (r) => await r.tags.merge(preact.id, react.id, preact.updatedAt));

      expect(await run(async (r) => await r.tags.listRecordTags())).toEqual([
        { tagId: react.id, recordId: record.id },
      ]);
    });

    it("refuses to merge a tag into itself, and moves nothing", async () => {
      const { react, record } = await run(async (r) => {
        const react = await r.tags.create(tagInput("React"));
        const record = await r.records.create(recordInput("project", "a0"));
        await r.tags.tagRecord(record.id, react.id);
        return { react, record };
      });

      await expect(
        run(async (r) => await r.tags.merge(react.id, react.id, react.updatedAt)),
      ).rejects.toBeInstanceOf(TagMergedIntoItselfError);
      expect(await run(async (r) => await r.tags.get(react.id))).toMatchObject({
        archivedAt: null,
      });
      expect(await run(async (r) => await r.tags.listRecordTags())).toEqual([
        { tagId: react.id, recordId: record.id },
      ]);
    });

    it("refuses to merge into a tag that does not exist", async () => {
      const react = await run(async (r) => await r.tags.create(tagInput("React")));

      await expect(
        run(async (r) => await r.tags.merge(react.id, newUuid(), react.updatedAt)),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    // The token guards the tag being merged away, and a stale one has to refuse
    // before anything moves - a merge is not undone by archiving it back.
    it("refuses a merge based on a stale read, leaving the assignments alone", async () => {
      const { react, preact, record } = await run(async (r) => {
        const react = await r.tags.create(tagInput("React"));
        const preact = await r.tags.create(tagInput("Preact"));
        const record = await r.records.create(recordInput("project", "a0"));
        await r.tags.tagRecord(record.id, preact.id);
        return { react, preact, record };
      });
      await run(
        async (r) => await r.tags.update(preact.id, { category: "skill" }, preact.updatedAt),
      );

      await expect(
        run(async (r) => await r.tags.merge(preact.id, react.id, preact.updatedAt)),
      ).rejects.toBeInstanceOf(ConcurrencyConflictError);
      expect(await run(async (r) => await r.tags.listRecordTags())).toEqual([
        { tagId: preact.id, recordId: record.id },
      ]);
    });
  });

  describe("filtering by tag", () => {
    it("narrows records and points to the ones carrying it", async () => {
      const { tag, tagged, point } = await run(async (r) => {
        const tag = await r.tags.create(tagInput("React"));
        const tagged = await r.records.create(recordInput("project", "a0"));
        await r.records.create(recordInput("project", "a1"));
        const point = await r.points.create(pointInput(tagged.id, "a0", "Tagged"));
        await r.points.create(pointInput(tagged.id, "a1", "Untagged"));
        await r.tags.tagRecord(tagged.id, tag.id);
        await r.tags.tagPoint(point.id, tag.id);
        return { tag, tagged, point };
      });

      expect(
        await run(async (r) => (await r.records.list({ tagId: tag.id })).map((e) => e.id)),
      ).toEqual([tagged.id]);
      expect(
        await run(async (r) => (await r.points.list({ tagId: tag.id })).map((e) => e.id)),
      ).toEqual([point.id]);
    });

    it("still narrows by kind and archived state at the same time", async () => {
      const { tag, project } = await run(async (r) => {
        const tag = await r.tags.create(tagInput("React"));
        const project = await r.records.create(recordInput("project", "a0"));
        const shelved = await r.records.create(recordInput("project", "a1"));
        const talk = await r.records.create(recordInput("speaking", "a0"));
        for (const entry of [project, shelved, talk]) {
          await r.tags.tagRecord(entry.id, tag.id);
        }
        await r.records.archive(shelved.id, shelved.updatedAt);
        return { tag, project };
      });

      expect(
        await run(async (r) =>
          (await r.records.list({ tagId: tag.id, kind: "project" })).map((e) => e.id),
        ),
      ).toEqual([project.id]);
      expect(
        await run(async (r) => await r.records.list({ tagId: tag.id, includeArchived: true })).then(
          (rows) => rows.length,
        ),
      ).toBe(3);
    });

    // The only shape in which a filter reading across owners answers with rows:
    // this owner's record, matched on the other owner's tagging of the same id.
    it("does not narrow by another owner's assignments", async () => {
      const tagId = newUuid();
      const recordId = newUuid();
      const pointId = newUuid();

      const asIntruder = await otherOwner();
      await asIntruder(async (r) => {
        await r.tags.create(tagInput("React", { id: tagId }));
        await r.records.create(recordInput("project", "a0", { id: recordId }));
        await r.points.create(pointInput(recordId, "a0", "Theirs", { id: pointId }));
        await r.tags.tagRecord(recordId, tagId);
        await r.tags.tagPoint(pointId, tagId);
      });
      await run(async (r) => {
        await r.tags.create(tagInput("React", { id: tagId }));
        await r.records.create(recordInput("project", "a0", { id: recordId }));
        await r.points.create(pointInput(recordId, "a0", "Mine", { id: pointId }));
      });

      expect(await run(async (r) => await r.records.list({ tagId }))).toEqual([]);
      expect(await run(async (r) => await r.points.list({ tagId }))).toEqual([]);
    });
  });
});
