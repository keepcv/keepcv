import { ConcurrencyConflictError, NotFoundError } from "@keepcv/core";
import { describe, expect, it } from "vitest";
import {
  eachDriver,
  savedFilterInput as filterInput,
  tagInput,
  violatedConstraint,
} from "./contract.harness.js";

eachDriver(({ run, otherOwner }) => {
  describe("saved filters", () => {
    it("keeps every narrowing the list it belongs to reads", async () => {
      const created = await run(
        async (r) =>
          await r.savedFilters.create(
            filterInput("React experience", { kind: "experience", query: "engine" }),
          ),
      );

      expect(created).toMatchObject({
        name: "React experience",
        subject: "record",
        kind: "experience",
        query: "engine",
        archived: "exclude",
        unfinished: null,
      });
    });

    it("narrows the list to one subject", async () => {
      await run(async (r) => {
        await r.savedFilters.create(filterInput("Experience"));
        await r.savedFilters.create(
          filterInput("No metric", { subject: "point", unfinished: "unmeasured" }),
        );
      });

      const points = await run(async (r) => await r.savedFilters.list({ subject: "point" }));
      expect(points.map((row) => row.name)).toEqual(["No metric"]);
    });

    // A record has no `unplaced` and a point has no kind, so a row carrying the
    // other subject's narrowing would filter by something no list reads.
    it("refuses a narrowing the subject has no list for", async () => {
      expect(
        await violatedConstraint(
          run(
            async (r) =>
              await r.savedFilters.create(filterInput("Wrong", { unfinished: "unplaced" })),
          ),
        ),
      ).toBe("saved_filter_subject_columns_check");

      expect(
        await violatedConstraint(
          run(
            async (r) =>
              await r.savedFilters.create(
                filterInput("Also wrong", { subject: "point", kind: "experience" }),
              ),
          ),
        ),
      ).toBe("saved_filter_subject_columns_check");
    });

    // Scoped to the list it is dragged within, which is the subject: two lists
    // that happened to use the same key would otherwise collide.
    it("scopes the sort key to the subject", async () => {
      await run(async (r) => {
        await r.savedFilters.create(filterInput("Experience", { sortKey: "a0" }));
        await r.savedFilters.create(filterInput("No metric", { subject: "point", sortKey: "a0" }));
      });

      expect(
        await violatedConstraint(
          run(async (r) => await r.savedFilters.create(filterInput("Another", { sortKey: "a0" }))),
        ),
      ).toBe("saved_filter_sort_key_unique");
    });

    it("orders by sort key, by code unit", async () => {
      await run(async (r) => {
        await r.savedFilters.create(filterInput("second", { sortKey: "a1" }));
        await r.savedFilters.create(filterInput("first", { sortKey: "Zz" }));
      });

      expect((await run(async (r) => await r.savedFilters.list())).map((row) => row.name)).toEqual([
        "first",
        "second",
      ]);
    });

    it("archives and puts back rather than deleting", async () => {
      const created = await run(async (r) => await r.savedFilters.create(filterInput("React")));

      const archived = await run(
        async (r) => await r.savedFilters.archive(created.id, created.updatedAt),
      );
      expect(archived.archivedAt).not.toBeNull();
      expect(await run(async (r) => await r.savedFilters.list())).toEqual([]);
      expect(
        await run(async (r) => await r.savedFilters.list({ includeArchived: true })),
      ).toHaveLength(1);

      const restored = await run(
        async (r) => await r.savedFilters.restore(archived.id, archived.updatedAt),
      );
      expect(restored.archivedAt).toBeNull();
    });

    it("refuses a write against a stale token", async () => {
      const created = await run(async (r) => await r.savedFilters.create(filterInput("React")));
      await run(
        async (r) =>
          await r.savedFilters.update(created.id, { name: "Renamed" }, created.updatedAt),
      );

      await expect(
        run(
          async (r) =>
            await r.savedFilters.update(created.id, { name: "Again" }, created.updatedAt),
        ),
      ).rejects.toThrow(ConcurrencyConflictError);
    });

    it("refuses a tag another owner holds", async () => {
      const asIntruder = await otherOwner();
      const theirTag = await asIntruder(async (r) => await r.tags.create(tagInput("Theirs")));

      expect(
        await violatedConstraint(
          run(
            async (r) => await r.savedFilters.create(filterInput("Mine", { tagId: theirTag.id })),
          ),
        ),
      ).toBe("saved_filter_tag_fk");
    });

    it("cannot reach another owner's filter", async () => {
      const asIntruder = await otherOwner();
      const theirs = await asIntruder(async (r) => await r.savedFilters.create(filterInput("T")));

      await expect(run(async (r) => await r.savedFilters.get(theirs.id))).rejects.toThrow(
        NotFoundError,
      );
      expect(await run(async (r) => await r.savedFilters.list())).toEqual([]);
    });
  });
});
