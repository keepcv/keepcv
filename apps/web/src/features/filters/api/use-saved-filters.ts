import type { SavedFilter, SavedFilterInput, SavedFilterPatch, Store } from "@keepcv/schema";
import { savedFilterSchema } from "@keepcv/schema";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { now, replaceRow, useStoreMutation } from "../../../lib/store-cache.js";

function upsert(store: Store, row: SavedFilter): Store {
  return { ...store, savedFilters: replaceRow(store.savedFilters, row) };
}

export function useSaveFilter(client: ApiClient) {
  return useStoreMutation<SavedFilterInput, SavedFilter>({
    send: async (input) =>
      savedFilterSchema.parse(
        await unwrap(await client.v1["saved-filters"].$post({ json: input })),
      ),
    optimistic: (store, input) => {
      const at = now();
      return upsert(
        store,
        savedFilterSchema.parse({ ...input, createdAt: at, updatedAt: at, archivedAt: null }),
      );
    },
  });
}

export interface RenameFilter {
  filter: SavedFilter;
  patch: SavedFilterPatch;
}

export function useRenameFilter(client: ApiClient) {
  return useStoreMutation<RenameFilter, SavedFilter>({
    send: async ({ filter, patch }) =>
      savedFilterSchema.parse(
        await unwrap(
          await client.v1["saved-filters"][":id"].$patch({
            param: { id: filter.id },
            json: { expectedUpdatedAt: filter.updatedAt, patch },
          }),
        ),
      ),
    optimistic: (store, { filter, patch }) =>
      upsert(store, savedFilterSchema.parse({ ...filter, ...patch, updatedAt: now() })),
  });
}

export function useForgetFilter(client: ApiClient) {
  return useStoreMutation<SavedFilter, SavedFilter>({
    send: async (filter) =>
      savedFilterSchema.parse(
        await unwrap(
          await client.v1["saved-filters"][":id"].$delete({
            param: { id: filter.id },
            json: { expectedUpdatedAt: filter.updatedAt },
          }),
        ),
      ),
    optimistic: (store, filter) =>
      upsert(store, { ...filter, archivedAt: now(), updatedAt: now() }),
  });
}
