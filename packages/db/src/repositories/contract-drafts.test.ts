import { NotFoundError, newUuid } from "@keepcv/core";
import { DRAFT_TARGET_KINDS, type DraftTarget, type Uuid } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import {
  eachDriver,
  newPhrasing,
  phrasingSetInput,
  type Run,
  recordInput,
  violatedConstraint,
} from "./contract.harness.js";

function onPhrasing(id: Uuid, field = "text"): DraftTarget {
  return { targetKind: "phrasing", targetId: id, field };
}

async function aRecord(run: Run): Promise<Uuid> {
  const created = await run(async (r) => await r.records.create(recordInput("project", "a0")));
  return created.id;
}

async function aPhrasing(run: Run): Promise<Uuid> {
  const set = await run(
    async (r) => await r.phrasings.createSet(phrasingSetInput("point", newPhrasing("a0", "words"))),
  );
  const [only] = await run(async (r) => await r.phrasings.list({ phrasingSetId: set.id }));
  if (only === undefined) throw new Error("a set is created holding its first phrasing");
  return only.id;
}

eachDriver(({ run, otherOwner }) => {
  describe("drafts", () => {
    it("keeps what the editor was holding", async () => {
      const phrasingId = await aPhrasing(run);
      const saved = await run(
        async (r) => await r.drafts.save(onPhrasing(phrasingId), { body: "half a sen" }),
      );

      expect(saved).toMatchObject({
        targetKind: "phrasing",
        targetId: phrasingId,
        field: "text",
        body: { body: "half a sen" },
      });
      expect(await run(async (r) => await r.drafts.list())).toEqual([saved]);
    });

    // The next keystrokes are meant to replace the last ones, which is why this
    // is the one write with no concurrency token to get in the way.
    it("overwrites rather than refusing or accumulating", async () => {
      const phrasingId = await aPhrasing(run);
      const target = onPhrasing(phrasingId);
      await run(async (r) => await r.drafts.save(target, { body: "half a sen" }));
      const later = await run(
        async (r) => await r.drafts.save(target, { body: "half a sentence" }),
      );

      const drafts = await run(async (r) => await r.drafts.list());
      expect(drafts).toEqual([later]);
      expect(drafts[0]?.body).toEqual({ body: "half a sentence" });
    });

    // The editor says how long the text has sat, so the first write dates it.
    it("keeps the moment the draft was started and moves the moment it changed", async () => {
      const phrasingId = await aPhrasing(run);
      const target = onPhrasing(phrasingId);
      const first = await run(async (r) => await r.drafts.save(target, { body: "a" }));
      // Timestamps are milliseconds, so two writes in the same tick carry the
      // same one and the assertion below would hold however the row was written.
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = await run(async (r) => await r.drafts.save(target, { body: "ab" }));

      expect(second.createdAt).toBe(first.createdAt);
      expect(new Date(second.updatedAt).getTime()).toBeGreaterThan(
        new Date(first.updatedAt).getTime(),
      );
    });

    it("keeps one draft per field of one target", async () => {
      const phrasingId = await aPhrasing(run);
      await run(async (r) => {
        await r.drafts.save(onPhrasing(phrasingId, "text"), { body: "the words" });
        await r.drafts.save(onPhrasing(phrasingId, "label"), { body: "the name" });
      });

      expect(await run(async (r) => (await r.drafts.list()).map((d) => d.field))).toEqual([
        "label",
        "text",
      ]);
    });

    it("drafts a record's field as readily as a phrasing's", async () => {
      const recordId = await aRecord(run);
      const saved = await run(
        async (r) =>
          await r.drafts.save(
            { targetKind: "record", targetId: recordId, field: "title" },
            { value: "Staff Engineer" },
          ),
      );

      expect(saved.targetKind).toBe("record");
      expect(await run(async (r) => await r.drafts.list())).toEqual([saved]);
    });

    // The target is polymorphic, so no foreign key can say this (I18).
    it("refuses a draft of something that is not there", async () => {
      await expect(
        run(async (r) => await r.drafts.save(onPhrasing(newUuid()), {})),
      ).rejects.toThrow(NotFoundError);
      await expect(
        run(
          async (r) =>
            await r.drafts.save(
              { targetKind: "record", targetId: newUuid(), field: "title" },
              { value: "nowhere" },
            ),
        ),
      ).rejects.toThrow(NotFoundError);
    });

    // Another owner's phrasing is not this owner's phrasing, so it is a 404 and
    // not a permission error: the store answers as if it does not exist.
    it("refuses a draft of another owner's row", async () => {
      const other = await otherOwner();
      const theirs = await aPhrasing(other);

      await expect(run(async (r) => await r.drafts.save(onPhrasing(theirs), {}))).rejects.toThrow(
        NotFoundError,
      );
    });

    it("shows an owner only their own drafts", async () => {
      const phrasingId = await aPhrasing(run);
      await run(async (r) => await r.drafts.save(onPhrasing(phrasingId), { body: "mine" }));

      const other = await otherOwner();
      const theirs = await aPhrasing(other);
      await other(async (r) => await r.drafts.save(onPhrasing(theirs), { body: "theirs" }));

      expect(await run(async (r) => (await r.drafts.list()).map((d) => d.body))).toEqual([
        { body: "mine" },
      ]);
    });

    // The one delete the store performs: by now the text is either a revision or
    // something the user explicitly abandoned.
    it("discards a draft, and discarding one that is not there is the same answer", async () => {
      const phrasingId = await aPhrasing(run);
      const target = onPhrasing(phrasingId);
      await run(async (r) => await r.drafts.save(target, { body: "a" }));

      await run(async (r) => {
        await r.drafts.discard(target);
        await r.drafts.discard(target);
      });
      expect(await run(async (r) => await r.drafts.list())).toEqual([]);
    });

    it("discards one field without touching the others", async () => {
      const phrasingId = await aPhrasing(run);
      await run(async (r) => {
        await r.drafts.save(onPhrasing(phrasingId, "text"), { body: "the words" });
        await r.drafts.save(onPhrasing(phrasingId, "label"), { body: "the name" });
        await r.drafts.discard(onPhrasing(phrasingId, "text"));
      });

      expect(await run(async (r) => (await r.drafts.list()).map((d) => d.field))).toEqual([
        "label",
      ]);
    });

    // Two stores hold the same target id once a backup is restored beside its
    // original, and a delete missing the owner predicate would take both.
    it("discards only its own row when another store holds the same one", async () => {
      const phrasingId = await aPhrasing(run);
      const target = onPhrasing(phrasingId);
      await run(async (r) => await r.drafts.save(target, { body: "a" }));
      const exported = await run(async (r) => await r.store.read());

      const other = await otherOwner();
      await other(async (r) => await r.store.load(exported));
      await run(async (r) => await r.drafts.discard(target));

      expect(await run(async (r) => await r.drafts.list())).toEqual([]);
      expect(await other(async (r) => await r.drafts.list())).toHaveLength(1);
    });

    it("returns a total order, so two reads of unchanged data are the same list", async () => {
      const recordId = await aRecord(run);
      const phrasingId = await aPhrasing(run);
      await run(async (r) => {
        await r.drafts.save(onPhrasing(phrasingId, "text"), {});
        await r.drafts.save({ targetKind: "record", targetId: recordId, field: "title" }, {});
      });

      expect(await run(async (r) => (await r.drafts.list()).map((d) => d.targetKind))).toEqual([
        "phrasing",
        "record",
      ]);
    });

    // The vocabulary is written out in the Drizzle schema and declared in Zod,
    // and this is what stops the two drifting apart.
    describe("vocabularies", () => {
      it("accepts exactly the target kinds the schema declares", async () => {
        const recordId = await aRecord(run);
        const phrasingId = await aPhrasing(run);
        const idOfKind: Record<string, Uuid> = { phrasing: phrasingId, record: recordId };

        await run(async (r) => {
          for (const kind of DRAFT_TARGET_KINDS) {
            await r.drafts.save(
              { targetKind: kind, targetId: idOfKind[kind] ?? recordId, field: "text" },
              {},
            );
          }
        });

        expect(
          await violatedConstraint(
            run(
              async (r) =>
                await r.drafts.save(
                  { targetKind: "resume" as never, targetId: recordId, field: "text" },
                  {},
                ),
            ),
          ),
        ).toBe("draft_target_kind_check");
      });
    });
  });
});
