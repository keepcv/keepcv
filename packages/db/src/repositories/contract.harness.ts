import { newUuid, type Repositories } from "@keepcv/core";
import type { Uuid } from "@keepcv/schema";
import { afterAll, beforeAll, beforeEach, describe } from "vitest";
import { runAsOwner } from "../owner-scope.js";
import { openLocalStore, openServerStore, type Store } from "../store.js";

// One suite, every implementation of the port. It asserts the invariants in
// data-model.md #10 rather than the queries, so an implementation that diverges
// fails loudly instead of subtly - which is the whole reason the private cloud
// repository can be a thin adapter rather than a fork.
const connectionString = process.env["DATABASE_URL"];

// Locally the server half is opt-in. In CI it is not: a suite that quietly
// tests one implementation and reports success for both is worse than no suite,
// and it has already happened once - turbo runs tasks in a strict environment
// and dropped DATABASE_URL before it reached vitest.
if (connectionString === undefined && process.env["CI"] !== undefined) {
  throw new Error("DATABASE_URL is unset, so the port would be tested against PGlite only");
}

const drivers: { name: string; open: () => Store }[] = [
  { name: "PGlite", open: () => openLocalStore() },
  ...(connectionString === undefined
    ? []
    : [{ name: "PostgreSQL", open: () => openServerStore({ connectionString }) }]),
];

export type Run = <T>(work: (repositories: Repositories) => Promise<T>) => Promise<T>;

export interface Driver {
  run: Run;
  otherOwner: () => Promise<Run>;
  store: () => Store;
}

export function eachDriver(suite: (driver: Driver) => void): void {
  describe.each(drivers)("$name", ({ open }) => {
    let store: Store;
    let current: Run;

    function asOwner(ownerId: Uuid): Run {
      return async (work) =>
        await runAsOwner(ownerId, async () => await store.unitOfWork.run(work));
    }

    async function mintOwner(): Promise<Run> {
      const ownerId = newUuid();
      await store.createOwner(ownerId);
      return asOwner(ownerId);
    }

    beforeAll(async () => {
      store = open();
      await store.migrate();
    });

    afterAll(async () => {
      await store.close();
    });

    // Every test gets its own owner rather than a truncated database. Owner
    // scoping is what isolates them, so the isolation under test is the
    // isolation the suite relies on.
    beforeEach(async () => {
      current = await mintOwner();
    });

    suite({
      run: async (work) => await current(work),
      otherOwner: mintOwner,
      store: () => store,
    });
  });
}
