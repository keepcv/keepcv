import type { CancellationSignal, UnitOfWork } from "@keepcv/core";
import { newUuid } from "@keepcv/core";
import { describe, expect, it } from "vitest";
import { createApi } from "./api.js";

describe("request transaction signals", () => {
  it.each(["/v1/profile", "/v1/store", "/v1/tags", "/v1/records", "/v1/resume-versions"])(
    "passes this Request's signal into the unit for %s",
    async (path) => {
      const signals: (CancellationSignal | undefined)[] = [];
      const unitOfWork: UnitOfWork = {
        run: (_work, options) => {
          signals.push(options?.signal);
          return Promise.reject(new Error("Synthetic unit refusal"));
        },
      };
      const app = createApi({
        unitOfWork,
        runAsOwner: async (_id, work) => await work(),
        authenticate: () => Promise.resolve(newUuid()),
        reportUnexpectedError: null,
      });
      const controller = new AbortController();
      const request = new Request(`http://localhost${path}`, { signal: controller.signal });
      controller.abort();
      expect((await app.fetch(request)).status).toBe(500);
      expect(signals).toHaveLength(1);
      expect(signals[0]).toBe(request.signal);
      expect(signals[0]?.aborted).toBe(true);
    },
  );
});
