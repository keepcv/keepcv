// Rows never leave this package. Everything exported here speaks DTOs from
// @keepcv/schema or the port from @keepcv/core.

export type { Database } from "./database.js";
export { currentOwnerId, OwnerScopeError, runAsOwner } from "./owner-scope.js";
export { type LocalStore, openLocalStore, openServerStore, type Store } from "./store.js";
