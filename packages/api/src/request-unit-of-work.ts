import type { UnitOfWork } from "@keepcv/core";
import type { Context } from "hono";

export function forRequest(unitOfWork: UnitOfWork, context: Context): UnitOfWork {
  return {
    run: async (work) => await unitOfWork.run(work, { signal: context.req.raw.signal }),
  };
}
