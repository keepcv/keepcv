import { AsyncLocalStorage } from "node:async_hooks";
import type { Uuid } from "@keepcv/schema";

const scope = new AsyncLocalStorage<Uuid>();

export class OwnerScopeError extends Error {
  override readonly name = "OwnerScopeError";
}

// Read here rather than passed, so "forgot to scope this query" is not a mistake
// a caller is able to make (api-contract.md #4).
export function runAsOwner<T>(ownerId: Uuid, work: () => Promise<T>): Promise<T> {
  return scope.run(ownerId, work);
}

export function currentOwnerId(): Uuid {
  const ownerId = scope.getStore();
  if (ownerId === undefined) {
    throw new OwnerScopeError("no owner is in scope; repository calls belong inside runAsOwner()");
  }
  return ownerId;
}
