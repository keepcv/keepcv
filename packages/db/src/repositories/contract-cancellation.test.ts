import { describe, expect, it } from "vitest";
import { eachDriver } from "./contract.harness.js";

eachDriver(({ run }) => {
  describe("unit cancellation boundaries", () => {
    it.each([null, "deadline", new Error("Caller cancellation")])(
      "preserves cancellation reason %s before callback execution",
      async (reason) => {
        const controller = new AbortController();
        controller.abort(reason);
        let calls = 0;
        await expect(
          run(
            () => {
              calls++;
              return Promise.resolve();
            },
            { signal: controller.signal },
          ),
        ).rejects.toBe(reason);
        expect(calls).toBe(0);
        expect((await run((r) => r.profile.get())).fullName).toBeNull();
      },
    );
    it("rolls back an abort before commit and retains ordinary no-signal callers", async () => {
      const before = await run((r) => r.profile.get());
      const controller = new AbortController();
      const reason = new Error("Before commit");
      await expect(
        run(
          async (r) => {
            await r.profile.update({ fullName: "Must roll back" }, before.updatedAt);
            controller.abort(reason);
          },
          { signal: controller.signal },
        ),
      ).rejects.toBe(reason);
      expect(await run((r) => r.profile.get())).toEqual(before);
      await run((r) => r.profile.update({ fullName: "Ordinary caller" }, before.updatedAt));
      expect((await run((r) => r.profile.get())).fullName).toBe("Ordinary caller");
    });
  });
});
