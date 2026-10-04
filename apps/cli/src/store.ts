import type { Repositories } from "@keepcv/core";
import { type LocalStore, openLocalStore, runAsOwner } from "@keepcv/db";
import type { Uuid } from "@keepcv/schema";
import { privateDirectory } from "./private-file.js";

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
    await privateDirectory(dataDir);
    store = openLocalStore({ dataDir });
    await store.migrate();
    return { store, ownerId: await store.ensureLocalOwner() };
  } catch (cause) {
    // Half-opened is still open: PGlite holds the directory until it is closed.
    await store?.close().catch(() => undefined);
    throw new StoreUnavailableError(dataDir, cause);
  }
}

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
