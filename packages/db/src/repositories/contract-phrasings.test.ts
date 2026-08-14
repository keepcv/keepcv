import {
  ConcurrencyConflictError,
  deriveRevision,
  generateNKeysBetween,
  NotFoundError,
  newUuid,
} from "@keepcv/core";
import { PHRASING_PURPOSES, PHRASING_VARIANTS, type RichText } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { eachDriver, newPhrasing, phrasingInput, phrasingSetInput } from "./contract.harness.js";

async function violatedConstraint(work: Promise<unknown>): Promise<string | undefined> {
  const thrown = await work.then(
    () => undefined,
    (error: unknown) => error,
  );
  return (thrown as { cause?: { constraint?: string } } | undefined)?.cause?.constraint;
}

const rewritten: RichText = [
  { t: "text", v: "Designs engines that " },
  { t: "b", c: [{ t: "text", v: "outlive" }] },
  { t: "text", v: " their authors" },
];

eachDriver(({ run, otherOwner }) => {
  describe("phrasing sets", () => {
    it("creates the set, its first phrasing and that phrasing's text together", async () => {
      const first = newPhrasing("a0", "Designs engines");
      const set = await run(
        async (r) => await r.phrasings.createSet(phrasingSetInput("profile_summary", first)),
      );

      expect(set.canonicalPhrasingId).toBe(first.id);

      const [phrasing] = await run(async (r) => await r.phrasings.list({ phrasingSetId: set.id }));
      expect(phrasing?.id).toBe(first.id);
      expect(phrasing?.currentRevisionId).not.toBeNull();

      const [revision] = await run(
        async (r) => await r.phrasings.listRevisions({ phrasingId: first.id }),
      );
      expect(revision?.plainText).toBe("Designs engines");
      expect(revision?.charCount).toBe(15);
      expect(revision?.contentHash).toBe(deriveRevision(first.body).contentHash);
    });

    it("cannot make another set's phrasing its canonical one", async () => {
      const theirs = newPhrasing("a0", "Theirs");
      const mine = await run(async (r) => {
        await r.phrasings.createSet(phrasingSetInput("point", theirs));
        return await r.phrasings.createSet(phrasingSetInput("point", newPhrasing("a0", "Mine")));
      });

      expect(
        await violatedConstraint(
          run(
            async (r) =>
              await r.phrasings.updateSet(
                mine.id,
                { canonicalPhrasingId: theirs.id },
                mine.updatedAt,
              ),
          ),
        ),
      ).toBe("phrasing_set_canonical_fk");
    });

    it("promotes a different phrasing to canonical in one write", async () => {
      const set = await run(
        async (r) => await r.phrasings.createSet(phrasingSetInput("point", newPhrasing("a0", "A"))),
      );
      const alternative = await run(
        async (r) =>
          await r.phrasings.create(phrasingInput(set.id, "a1", "B", { variant: "short" })),
      );

      const promoted = await run(
        async (r) =>
          await r.phrasings.updateSet(
            set.id,
            { canonicalPhrasingId: alternative.id },
            set.updatedAt,
          ),
      );
      expect(promoted.canonicalPhrasingId).toBe(alternative.id);

      // The demoted one keeps its variant: which wording is canonical is a
      // pointer, not a label on the wording itself.
      expect(await run(async (r) => await r.phrasings.get(alternative.id))).toMatchObject({
        variant: "short",
      });
    });

    it("hides archived sets by default and brings them back", async () => {
      const set = await run(
        async (r) =>
          await r.phrasings.createSet(phrasingSetInput("record_summary", newPhrasing("a0", "A"))),
      );

      const archived = await run(async (r) => await r.phrasings.archiveSet(set.id, set.updatedAt));
      expect(await run(async (r) => await r.phrasings.listSets())).toHaveLength(0);
      expect(
        await run(async (r) => await r.phrasings.listSets({ includeArchived: true })),
      ).toHaveLength(1);

      await run(async (r) => await r.phrasings.restoreSet(archived.id, archived.updatedAt));
      expect(await run(async (r) => await r.phrasings.listSets())).toHaveLength(1);
    });

    it("rejects a write based on a stale read", async () => {
      const first = newPhrasing("a0", "A");
      const set = await run(
        async (r) => await r.phrasings.createSet(phrasingSetInput("point", first)),
      );
      const patch = { canonicalPhrasingId: first.id };
      await run(async (r) => await r.phrasings.updateSet(set.id, patch, set.updatedAt));

      await expect(
        run(async (r) => await r.phrasings.updateSet(set.id, patch, set.updatedAt)),
      ).rejects.toThrow(ConcurrencyConflictError);
    });

    it("is invisible to another owner, down to the revision history", async () => {
      const first = newPhrasing("a0", "A");
      const set = await run(
        async (r) => await r.phrasings.createSet(phrasingSetInput("point", first)),
      );
      const other = await otherOwner();

      expect(await other(async (r) => await r.phrasings.listSets())).toHaveLength(0);
      expect(await other(async (r) => await r.phrasings.list())).toHaveLength(0);
      expect(await other(async (r) => await r.phrasings.listRevisions())).toHaveLength(0);
      await expect(other(async (r) => await r.phrasings.getSet(set.id))).rejects.toThrow(
        NotFoundError,
      );
      await expect(other(async (r) => await r.phrasings.get(first.id))).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("phrasings", () => {
    it("orders a set's wordings by sort key and hides archived ones", async () => {
      const set = await run(
        async (r) =>
          await r.phrasings.createSet(phrasingSetInput("point", newPhrasing("a1", "middle"))),
      );
      const [first, last] = await run(async (r) => [
        await r.phrasings.create(phrasingInput(set.id, "a0", "first", { variant: "short" })),
        await r.phrasings.create(phrasingInput(set.id, "a2", "last", { variant: "long" })),
      ]);

      const listed = await run(async (r) => await r.phrasings.list({ phrasingSetId: set.id }));
      expect(listed.map((p) => p.sortKey)).toEqual(["a0", "a1", "a2"]);
      expect(first.variant).toBe("short");

      await run(async (r) => await r.phrasings.archive(last.id, last.updatedAt));
      expect(
        await run(async (r) => await r.phrasings.list({ phrasingSetId: set.id })),
      ).toHaveLength(2);
    });

    it("keeps sort keys unique within a set and free to repeat across sets", async () => {
      const [one, two] = await run(async (r) => [
        await r.phrasings.createSet(phrasingSetInput("point", newPhrasing("a0", "one"))),
        await r.phrasings.createSet(phrasingSetInput("point", newPhrasing("a0", "two"))),
      ]);
      expect(one.id).not.toBe(two.id);

      expect(
        await violatedConstraint(
          run(async (r) => await r.phrasings.create(phrasingInput(one.id, "a0", "clash"))),
        ),
      ).toBe("phrasing_sort_key_unique");
    });

    // The patch type has no `body`, so this is what the storage side of that rule
    // looks like: renaming a wording leaves the words alone.
    it("renames a wording without touching its text", async () => {
      const first = newPhrasing("a0", "A");
      await run(async (r) => await r.phrasings.createSet(phrasingSetInput("point", first)));
      const before = await run(async (r) => await r.phrasings.get(first.id));

      const renamed = await run(
        async (r) =>
          await r.phrasings.update(before.id, { label: "for platform roles" }, before.updatedAt),
      );
      expect(renamed.label).toBe("for platform roles");
      expect(renamed.currentRevisionId).toBe(before.currentRevisionId);
    });
  });

  describe("revisions", () => {
    it("appends new text and points the phrasing at it", async () => {
      const first = newPhrasing("a0", "Designs engines that outlive their authors");
      await run(
        async (r) => await r.phrasings.createSet(phrasingSetInput("profile_summary", first)),
      );
      const id = first.id;

      const revision = await run(async (r) => await r.phrasings.addRevision(id, rewritten));
      expect(revision.plainText).toBe("Designs engines that outlive their authors");
      expect(await run(async (r) => await r.phrasings.get(id))).toMatchObject({
        currentRevisionId: revision.id,
      });
      expect(
        await run(async (r) => await r.phrasings.listRevisions({ phrasingId: id })),
      ).toHaveLength(2);
    });

    // Retyping a word and undoing it must not add to the history, and reverting
    // to an earlier wording must not add a second copy of it either (I3).
    it("stores one revision per distinct text, whatever order they arrive in", async () => {
      const first = newPhrasing("a0", "Designs engines");
      await run(async (r) => await r.phrasings.createSet(phrasingSetInput("point", first)));
      const id = first.id;
      const original = await run(async (r) => await r.phrasings.get(id));

      await run(async (r) => await r.phrasings.addRevision(id, first.body));
      expect(
        await run(async (r) => await r.phrasings.listRevisions({ phrasingId: id })),
      ).toHaveLength(1);

      await run(async (r) => await r.phrasings.addRevision(id, rewritten));
      const reverted = await run(async (r) => await r.phrasings.addRevision(id, first.body));

      expect(reverted.id).toBe(original.currentRevisionId);
      expect(
        await run(async (r) => await r.phrasings.listRevisions({ phrasingId: id })),
      ).toHaveLength(2);
      expect(await run(async (r) => await r.phrasings.get(id))).toMatchObject({
        currentRevisionId: reverted.id,
      });
    });

    // Two bodies that render the same words are the same revision, so an editor
    // that emits b(x)b(y) on one pass and b(xy) on the next cannot fill the
    // history with edits nobody made.
    it("treats two spellings of one body as the same text", async () => {
      const first = newPhrasing("a0", "text", {
        body: [{ t: "b", c: [{ t: "text", v: "Designs engines" }] }],
      });
      const set = await run(
        async (r) => await r.phrasings.createSet(phrasingSetInput("point", first)),
      );
      expect(set.purpose).toBe("point");

      await run(
        async (r) =>
          await r.phrasings.addRevision(first.id, [
            { t: "b", c: [{ t: "text", v: "Designs " }] },
            { t: "b", c: [{ t: "text", v: "engines" }] },
          ]),
      );
      expect(
        await run(async (r) => await r.phrasings.listRevisions({ phrasingId: first.id })),
      ).toHaveLength(1);
    });

    // Appending cannot conflict with anything, so it must not consume the token a
    // rename in another tab is holding. Rejecting that edit is exactly the loss
    // the append-only design exists to prevent.
    it("leaves a token the caller is already holding usable", async () => {
      const first = newPhrasing("a0", "Designs engines");
      await run(async (r) => await r.phrasings.createSet(phrasingSetInput("point", first)));
      const before = await run(async (r) => await r.phrasings.get(first.id));

      await run(async (r) => await r.phrasings.addRevision(first.id, rewritten));

      const renamed = await run(
        async (r) => await r.phrasings.update(first.id, { label: "kept" }, before.updatedAt),
      );
      expect(renamed.label).toBe("kept");
    });

    it("refuses to append to a phrasing that does not exist", async () => {
      await expect(
        run(async (r) => await r.phrasings.addRevision(newUuid(), rewritten)),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // Two vocabularies written out in the Drizzle schema and declared in Zod, kept
  // from drifting: every declared value has to insert, and an undeclared one must
  // not.
  describe("vocabularies", () => {
    it("accepts exactly the purposes the schema declares", async () => {
      await run(async (r) => {
        for (const purpose of PHRASING_PURPOSES) {
          await r.phrasings.createSet(phrasingSetInput(purpose, newPhrasing("a0", purpose)));
        }
      });

      await expect(
        run(
          async (r) =>
            await r.phrasings.createSet(phrasingSetInput("cover_letter", newPhrasing("a0", "no"))),
        ),
      ).rejects.toThrow();
    });

    it("accepts exactly the variants the schema declares", async () => {
      const set = await run(
        async (r) => await r.phrasings.createSet(phrasingSetInput("point", newPhrasing("a0", "A"))),
      );
      const keys = generateNKeysBetween("a0", null, PHRASING_VARIANTS.length);

      await run(async (r) => {
        for (const [index, variant] of PHRASING_VARIANTS.entries()) {
          await r.phrasings.create(phrasingInput(set.id, keys[index] ?? "", variant, { variant }));
        }
      });

      await expect(
        run(
          async (r) =>
            await r.phrasings.create(
              phrasingInput(set.id, "z0", "no", { variant: "canonical" as never }),
            ),
        ),
      ).rejects.toThrow();
    });
  });
});
