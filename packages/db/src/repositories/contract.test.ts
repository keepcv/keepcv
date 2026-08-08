import {
  ConcurrencyConflictError,
  generateNKeysBetween,
  NotFoundError,
  newUuid,
  type Repositories,
} from "@keepcv/core";
import { CONTACT_CHANNEL_KINDS, type ContactChannelInput, type Uuid } from "@keepcv/schema";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runAsOwner } from "../owner-scope.js";
import { openLocalStore, openServerStore, type Store } from "../store.js";

// One suite, every implementation of the port. It asserts the invariants in
// data-model.md #10 rather than the queries, so an implementation that diverges
// fails loudly instead of subtly - which is the whole reason the private cloud
// repository can be a thin adapter rather than a fork.
const connectionString = process.env["DATABASE_URL"];

const drivers: { name: string; open: () => Store }[] = [
  { name: "PGlite", open: () => openLocalStore() },
  ...(connectionString === undefined
    ? []
    : [{ name: "PostgreSQL", open: () => openServerStore({ connectionString }) }]),
];

function channel(sortKey: string, overrides: Partial<ContactChannelInput> = {}) {
  return {
    id: newUuid(),
    kind: "email",
    label: null,
    value: "ada@example.com",
    isDefaultVisible: true,
    sortKey,
    ...overrides,
  } as ContactChannelInput;
}

describe.each(drivers)("$name", ({ open }) => {
  let store: Store;
  let run: <T>(work: (repositories: Repositories) => Promise<T>) => Promise<T>;

  function asOwner(ownerId: Uuid) {
    return async <T>(work: (repositories: Repositories) => Promise<T>) =>
      await runAsOwner(ownerId, async () => await store.unitOfWork.run(work));
  }

  beforeAll(async () => {
    store = open();
    await store.migrate();
  });

  afterAll(async () => {
    await store.close();
  });

  // Every test gets its own owner rather than a truncated database. Owner
  // scoping is what isolates them, so the isolation under test is the isolation
  // the suite relies on.
  beforeEach(async () => {
    const ownerId = newUuid();
    await store.createOwner(ownerId);
    run = asOwner(ownerId);
  });

  describe("bootstrap", () => {
    it("gives a new owner an empty profile", async () => {
      const profile = await run(async (repositories) => await repositories.profile.get());
      expect(profile.fullName).toBeNull();
      expect(profile.headline).toBeNull();
      expect(profile.archivedAt).toBeNull();
    });

    it("refuses a repository call with no owner in scope", async () => {
      await expect(store.unitOfWork.run(async (r) => await r.profile.get())).rejects.toThrow(
        /no owner is in scope/,
      );
    });
  });

  describe("owner scoping", () => {
    it("hides another owner's rows entirely", async () => {
      const intruderId = newUuid();
      await store.createOwner(intruderId);
      const asIntruder = asOwner(intruderId);

      const mine = await run(
        async (r) => await r.profile.createContactChannel(channel("a0", { value: "mine" })),
      );

      const theirs = await asIntruder(async (r) => await r.profile.listContactChannels());
      expect(theirs).toEqual([]);

      // Not a 403: a row outside the scope does not exist as far as the caller
      // is concerned, and saying "forbidden" would confirm that it does.
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
        await r.profile.createContactChannel(channel(third ?? "", { value: "third" }));
        await r.profile.createContactChannel(channel(first ?? "", { value: "first" }));
        await r.profile.createContactChannel(channel(second ?? "", { value: "second" }));
      });

      const channels = await run(async (r) => await r.profile.listContactChannels());
      expect(channels.map((c) => c.value)).toEqual(["first", "second", "third"]);
    });

    // The CHECK is written out in the Drizzle schema and the vocabulary lives in
    // @keepcv/schema. This is what stops the two drifting.
    it("accepts exactly the declared kinds", async () => {
      const keys = generateNKeysBetween(null, null, CONTACT_CHANNEL_KINDS.length);
      await run(async (r) => {
        for (const [index, kind] of CONTACT_CHANNEL_KINDS.entries()) {
          await r.profile.createContactChannel(channel(keys[index] ?? "", { kind }));
        }
      });

      const channels = await run(async (r) => await r.profile.listContactChannels());
      expect(channels.map((c) => c.kind).sort()).toEqual([...CONTACT_CHANNEL_KINDS].sort());

      await expect(
        run(
          async (r) =>
            await r.profile.createContactChannel({
              ...channel("z0"),
              kind: "mastodon" as ContactChannelInput["kind"],
            }),
        ),
      ).rejects.toThrow();
    });

    it("keeps sort keys unique within the owner", async () => {
      await run(async (r) => await r.profile.createContactChannel(channel("a0")));
      await expect(
        run(async (r) => await r.profile.createContactChannel(channel("a0"))),
      ).rejects.toThrow();
    });

    it("archives without destroying, and restores", async () => {
      const created = await run(
        async (r) =>
          await r.profile.createContactChannel(channel("a0", { value: "ada@example.com" })),
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

    it("distinguishes an unknown id from a stale one", async () => {
      const created = await run(async (r) => await r.profile.createContactChannel(channel("a0")));
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
          await r.profile.createContactChannel(channel("a0"));
          await r.profile.createContactChannel(channel("a0"));
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
            await run(async (r) => await r.profile.createContactChannel(channel(sortKey))),
        ),
      );

      expect(await run(async (r) => await r.profile.listContactChannels())).toHaveLength(5);
    });
  });
});

describe("local store", () => {
  it("returns the same owner on every launch", async () => {
    const store = openLocalStore();
    await store.migrate();
    try {
      const first = await store.ensureLocalOwner();
      expect(await store.ensureLocalOwner()).toBe(first);
    } finally {
      await store.close();
    }
  });
});
