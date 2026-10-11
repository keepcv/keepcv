import { NotFoundError, newUuid } from "@keepcv/core";
import type { Uuid } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { OwnerScopeError, runAsOwner } from "./owner-scope.js";
import { eachDriver, type Run, tagInput } from "./repositories/contract.harness.js";
import { fill } from "./repositories/contract-store.harness.js";
import { openLocalStore } from "./store.js";

eachDriver(({ store, run }) => {
  const asOwner =
    (id: Uuid): Run =>
    (work) =>
      runAsOwner(id, () => store().unitOfWork.run(work));

  it("provisions one owner and profile under concurrent retries without resetting edits", async () => {
    const id = newUuid();
    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, () => store().provisionOwner(id)),
    );
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toEqual([]);
    const profile = await asOwner(id)((r) => r.profile.get());
    await asOwner(id)((r) =>
      r.profile.update({ fullName: "Kept through retries" }, profile.updatedAt),
    );
    const before = await asOwner(id)((r) => r.store.read());
    await Promise.all(Array.from({ length: 8 }, () => store().provisionOwner(id)));
    expect(await asOwner(id)((r) => r.store.read())).toEqual(before);
  });

  it("keeps concurrent imported ids and revisions separate and refuses guessed ids", async () => {
    await fill(run);
    const archive = await run((r) => r.store.read());
    const owners = [newUuid(), newUuid()];
    const [first, second] = owners.map(asOwner);
    if (first === undefined || second === undefined) throw new Error("Missing fixture owners");
    await Promise.all(owners.map((id) => store().provisionOwner(id)));
    await Promise.all([first((r) => r.store.load(archive)), second((r) => r.store.load(archive))]);
    expect(await first((r) => r.store.read())).toEqual(archive);
    expect(await second((r) => r.store.read())).toEqual(archive);
    const phrasing = archive.phrasings[0];
    if (phrasing === undefined) throw new Error("Missing fixture phrasing");
    await first((r) =>
      r.phrasings.addRevision(phrasing.id, [{ t: "text", v: "Changed only here" }]),
    );
    expect(await second((r) => r.store.read())).toEqual(archive);
    const tag = await first((r) => r.tags.create(tagInput("Only the first owner")));
    await expect(second((r) => r.tags.get(tag.id))).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      second((r) => r.tags.update(tag.id, { label: "Guessed" }, tag.updatedAt)),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(second((r) => r.tags.archive(tag.id, tag.updatedAt))).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(await first((r) => r.tags.get(tag.id))).toEqual(tag);
    await expect(store().unitOfWork.run((r) => r.profile.get())).rejects.toBeInstanceOf(
      OwnerScopeError,
    );
  });

  it("erases a complete owner only after confirmation and leaves identical imported ids intact", async () => {
    const erased = newUuid();
    const kept = newUuid();
    await Promise.all([store().provisionOwner(erased), store().provisionOwner(kept)]);
    await fill(asOwner(erased));
    const archive = await asOwner(erased)((r) => r.store.read());
    await asOwner(kept)((r) => r.store.load(archive));
    await expect(
      store().eraseOwner(erased, { erasePermanently: false } as unknown as {
        erasePermanently: true;
      }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(await asOwner(erased)((r) => r.store.read())).toEqual(archive);
    await store().eraseOwner(erased, { erasePermanently: true });
    await store().eraseOwner(erased, { erasePermanently: true });
    await expect(asOwner(erased)((r) => r.profile.get())).rejects.toBeInstanceOf(NotFoundError);
    expect(await asOwner(kept)((r) => r.store.read())).toEqual(archive);
    await store().provisionOwner(erased);
    const fresh = await asOwner(erased)((r) => r.store.read());
    expect(fresh.profile.id).not.toBe(archive.profile.id);
    expect(fresh.profile.fullName).toBeNull();
    for (const [name, rows] of Object.entries(fresh)) {
      if (name !== "profile") expect(rows, name).toEqual([]);
    }
  });
});

describe("local shutdown", () => {
  it("shares completion across repeated closes", async () => {
    const store = openLocalStore();
    await store.migrate();
    const closing = store.close();
    expect(store.close()).toBe(closing);
    await closing;
    await store.close();
  }, 60_000);
});
