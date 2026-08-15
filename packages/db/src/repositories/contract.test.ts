import {
  ConcurrencyConflictError,
  ConstraintViolationError,
  generateNKeysBetween,
  NotFoundError,
  newUuid,
} from "@keepcv/core";
import { CONTACT_CHANNEL_KINDS, type ContactChannelInput } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { openLocalStore } from "../store.js";
import { BOOTS_A_STORE, channelInput, eachDriver, violatedConstraint } from "./contract.harness.js";

eachDriver(({ run, otherOwner, store }) => {
  describe("bootstrap", () => {
    it("gives a new owner an empty profile", async () => {
      const profile = await run(async (repositories) => await repositories.profile.get());
      expect(profile.fullName).toBeNull();
      expect(profile.headline).toBeNull();
      expect(profile.archivedAt).toBeNull();
    });

    it("refuses a repository call with no owner in scope", async () => {
      await expect(store().unitOfWork.run(async (r) => await r.profile.get())).rejects.toThrow(
        /no owner is in scope/,
      );
    });
  });

  describe("owner scoping", () => {
    it("hides another owner's rows entirely", async () => {
      const asIntruder = await otherOwner();

      const mine = await run(
        async (r) => await r.profile.createContactChannel(channelInput("a0", { value: "mine" })),
      );

      const theirs = await asIntruder(async (r) => await r.profile.listContactChannels());
      expect(theirs).toEqual([]);

      // Not a 403: a row outside the scope does not exist as far as the caller
      // is concerned, and saying "forbidden" would confirm that it does.
      await expect(
        asIntruder(async (r) => await r.profile.getContactChannel(mine.id)),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        asIntruder(async (r) => await r.profile.archiveContactChannel(mine.id, mine.updatedAt)),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("profile", () => {
    it("applies a sparse patch and leaves absent fields alone", async () => {
      const before = await run(async (r) => await r.profile.get());
      const named = await run(
        async (r) => await r.profile.update({ fullName: "Ada Lovelace" }, before.updatedAt),
      );
      expect(named.fullName).toBe("Ada Lovelace");

      const headlined = await run(
        async (r) => await r.profile.update({ headline: "Mathematician" }, named.updatedAt),
      );
      expect(headlined.fullName).toBe("Ada Lovelace");
      expect(headlined.headline).toBe("Mathematician");
    });

    it("clears a field on an explicit null", async () => {
      const before = await run(async (r) => await r.profile.get());
      const named = await run(
        async (r) => await r.profile.update({ pronouns: "she/her" }, before.updatedAt),
      );
      const cleared = await run(
        async (r) => await r.profile.update({ pronouns: null }, named.updatedAt),
      );
      expect(cleared.pronouns).toBeNull();
    });

    it("rejects a write based on a stale read", async () => {
      const before = await run(async (r) => await r.profile.get());
      await run(async (r) => await r.profile.update({ fullName: "first" }, before.updatedAt));

      const conflict = await run(
        async (r) =>
          await r.profile
            .update({ fullName: "second" }, before.updatedAt)
            .catch((error: unknown) => error),
      );
      expect(conflict).toBeInstanceOf(ConcurrencyConflictError);
      expect((conflict as ConcurrencyConflictError).currentUpdatedAt).not.toBe(before.updatedAt);
    });
  });

  describe("contact channels", () => {
    it("returns them in sort-key order regardless of insertion order", async () => {
      const [first, second, third] = generateNKeysBetween(null, null, 3);
      await run(async (r) => {
        await r.profile.createContactChannel(channelInput(third ?? "", { value: "third" }));
        await r.profile.createContactChannel(channelInput(first ?? "", { value: "first" }));
        await r.profile.createContactChannel(channelInput(second ?? "", { value: "second" }));
      });

      const channels = await run(async (r) => await r.profile.listContactChannels());
      expect(channels.map((c) => c.value)).toEqual(["first", "second", "third"]);
    });

    // A refused write reaches the API as a domain error or it is answered as a
    // server fault, and two clients dragging at once is a caller mistake.
    it("keeps sort keys unique within the owner", async () => {
      await run(async (r) => await r.profile.createContactChannel(channelInput("a0")));

      const thrown = await run(
        async (r) => await r.profile.createContactChannel(channelInput("a0")),
      ).then(
        () => undefined,
        (error: unknown) => error,
      );
      expect(thrown).toBeInstanceOf(ConstraintViolationError);
      expect((thrown as ConstraintViolationError).kind).toBe("unique");
      expect((thrown as ConstraintViolationError).constraint).toBe(
        "contact_channel_sort_key_unique",
      );
    });

    it("archives without destroying, and restores", async () => {
      const created = await run(
        async (r) =>
          await r.profile.createContactChannel(channelInput("a0", { value: "ada@example.com" })),
      );

      const archived = await run(
        async (r) => await r.profile.archiveContactChannel(created.id, created.updatedAt),
      );
      expect(archived.archivedAt).not.toBeNull();
      expect(archived.value).toBe("ada@example.com");

      expect(await run(async (r) => await r.profile.listContactChannels())).toEqual([]);
      expect(
        await run(async (r) => await r.profile.listContactChannels({ includeArchived: true })),
      ).toHaveLength(1);

      const restored = await run(
        async (r) => await r.profile.restoreContactChannel(archived.id, archived.updatedAt),
      );
      expect(restored.archivedAt).toBeNull();
      expect(await run(async (r) => await r.profile.listContactChannels())).toHaveLength(1);
    });

    it("reads one back by id, archived or not", async () => {
      const created = await run(
        async (r) =>
          await r.profile.createContactChannel(channelInput("a0", { value: "ada@e.com" })),
      );
      expect(await run(async (r) => await r.profile.getContactChannel(created.id))).toEqual(
        created,
      );

      const archived = await run(
        async (r) => await r.profile.archiveContactChannel(created.id, created.updatedAt),
      );
      // Reading one by id ignores `archived_at`, unlike listing: a link to an
      // archived channel must resolve, or "where did it go" has no answer.
      expect(await run(async (r) => await r.profile.getContactChannel(created.id))).toEqual(
        archived,
      );

      await expect(
        run(async (r) => await r.profile.getContactChannel(newUuid())),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("distinguishes an unknown id from a stale one", async () => {
      const created = await run(
        async (r) => await r.profile.createContactChannel(channelInput("a0")),
      );
      const updated = await run(
        async (r) =>
          await r.profile.updateContactChannel(created.id, { label: "Work" }, created.updatedAt),
      );

      await expect(
        run(async (r) => await r.profile.updateContactChannel(newUuid(), {}, updated.updatedAt)),
      ).rejects.toBeInstanceOf(NotFoundError);

      await expect(
        run(
          async (r) =>
            await r.profile.updateContactChannel(created.id, { label: "Home" }, created.updatedAt),
        ),
      ).rejects.toBeInstanceOf(ConcurrencyConflictError);
    });
  });

  describe("transactions", () => {
    it("rolls the whole unit back when any part of it fails", async () => {
      await expect(
        run(async (r) => {
          await r.profile.createContactChannel(channelInput("a0"));
          await r.profile.createContactChannel(channelInput("a0"));
        }),
      ).rejects.toThrow();

      expect(await run(async (r) => await r.profile.listContactChannels())).toEqual([]);
    });

    // PGlite holds one connection, so overlapping units are only safe while
    // every statement goes through a transaction. The composer fires several
    // optimistic mutations at once while dragging, so this is reachable.
    it("keeps concurrent units from interleaving", async () => {
      const keys = generateNKeysBetween(null, null, 5);
      await Promise.all(
        keys.map(
          async (sortKey) =>
            await run(async (r) => await r.profile.createContactChannel(channelInput(sortKey))),
        ),
      );

      expect(await run(async (r) => await r.profile.listContactChannels())).toHaveLength(5);
    });
  });

  // The CHECK constraints are written out in the Drizzle schema because
  // drizzle-kit cannot resolve @keepcv/schema. This is what stops the two lists
  // drifting: one test for every vocabulary the store declares.
  describe("vocabularies", () => {
    it("accepts exactly the contact channel kinds the schema declares", async () => {
      const keys = generateNKeysBetween(null, null, CONTACT_CHANNEL_KINDS.length);
      await run(async (r) => {
        for (const [index, kind] of CONTACT_CHANNEL_KINDS.entries()) {
          await r.profile.createContactChannel(channelInput(keys[index] ?? "", { kind }));
        }
      });

      const channels = await run(async (r) => await r.profile.listContactChannels());
      expect(channels.map((c) => c.kind).sort()).toEqual([...CONTACT_CHANNEL_KINDS].sort());

      expect(
        await violatedConstraint(
          run(
            async (r) =>
              await r.profile.createContactChannel({
                ...channelInput("z0"),
                kind: "mastodon" as ContactChannelInput["kind"],
              }),
          ),
        ),
      ).toBe("contact_channel_kind_check");
    });
  });
});

describe("local store", () => {
  // The one test that boots its own store in the body rather than a hook, so it
  // needs the hook's budget: the default five seconds is not enough for a
  // WebAssembly start and every migration while the rest of the repo's suites
  // are running beside it.
  it(
    "returns the same owner on every launch",
    async () => {
      const store = openLocalStore();
      await store.migrate();
      try {
        const first = await store.ensureLocalOwner();
        expect(await store.ensureLocalOwner()).toBe(first);
      } finally {
        await store.close();
      }
    },
    BOOTS_A_STORE,
  );
});
