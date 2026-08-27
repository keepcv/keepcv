import type { Repositories } from "@keepcv/core";
import { type LocalStore, openLocalStore, runAsOwner } from "@keepcv/db";
import type { Uuid } from "@keepcv/schema";

// A data directory that cannot be opened surfaces as whichever mkdir or query
// was in flight, which reads as a bug in this product rather than as a path the
// user cannot write to.
export class StoreUnavailableError extends Error {
  constructor(dataDir: string, cause: unknown) {
    super(
      `Cannot open the store at ${dataDir}. Check the path is writable and that nothing else is using it.`,
      { cause },
    );
    this.name = "StoreUnavailableError";
  }
}

export async function openStore(dataDir: string): Promise<{ store: LocalStore; ownerId: Uuid }> {
  let store: LocalStore | undefined;
  try {
    store = openLocalStore({ dataDir });
    await store.migrate();
    return { store, ownerId: await store.ensureLocalOwner() };
  } catch (cause) {
    // Half-opened is still open: PGlite holds the directory until it is closed.
    await store?.close().catch(() => undefined);
    throw new StoreUnavailableError(dataDir, cause);
  }
}

// Every command but `serve` opens the store, does one thing and closes it.
export async function withStore<T>(
  dataDir: string,
  work: (repositories: Repositories) => Promise<T>,
): Promise<T> {
  const { store, ownerId } = await openStore(dataDir);
  try {
    return await runAsOwner(ownerId, async () => await store.unitOfWork.run(work));
  } finally {
    await store.close();
  }
}
