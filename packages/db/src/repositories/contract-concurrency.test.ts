import { ConcurrencyConflictError } from "@keepcv/core";
import { expect, it, vi } from "vitest";
import { eachDriver, roleProfileInput } from "./contract.harness.js";

eachDriver(({ run }) => {
  it("advances an owned row's token when the clock stands still or moves backward", async () => {
    const created = await run(async (r) => await r.roleProfiles.create(roleProfileInput("First")));
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(created.updatedAt));
      const updated = await run(
        async (r) => await r.roleProfiles.update(created.id, { name: "Second" }, created.updatedAt),
      );
      expect(Date.parse(updated.updatedAt)).toBe(Date.parse(created.updatedAt) + 1);
      await expect(
        run(
          async (r) =>
            await r.roleProfiles.update(created.id, { name: "Stale" }, created.updatedAt),
        ),
      ).rejects.toThrow(ConcurrencyConflictError);
      vi.setSystemTime(new Date(Date.parse(created.updatedAt) - 1000));
      const later = await run(
        async (r) => await r.roleProfiles.update(created.id, { name: "Third" }, updated.updatedAt),
      );
      expect(Date.parse(later.updatedAt)).toBe(Date.parse(updated.updatedAt) + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("advances the profile token when two edits share one millisecond", async () => {
    const before = await run(async (r) => await r.profile.get());
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(before.updatedAt));
      const updated = await run(
        async (r) => await r.profile.update({ fullName: "First" }, before.updatedAt),
      );
      expect(Date.parse(updated.updatedAt)).toBe(Date.parse(before.updatedAt) + 1);
      await expect(
        run(async (r) => await r.profile.update({ fullName: "Stale" }, before.updatedAt)),
      ).rejects.toThrow(ConcurrencyConflictError);
    } finally {
      vi.useRealTimers();
    }
  });
});
