import { type Store, storeSchema } from "@keepcv/schema";
import { type QueryClient, queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { type ApiClient, unwrap } from "../../../lib/api.js";

export const STORE_KEY = ["store"] as const;

// One request boots the app (application-structure.md #4). Only this client
// writes, so it stays fresh until a mutation says otherwise.
export function storeQuery(client: ApiClient) {
  return queryOptions({
    queryKey: STORE_KEY,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async (): Promise<Store> => {
      return storeSchema.parse(await unwrap(await client.v1.store.$get()));
    },
  });
}

export function useStore(client: ApiClient): Store {
  return useSuspenseQuery(storeQuery(client)).data;
}

export async function prefetchStore(queries: QueryClient, client: ApiClient): Promise<void> {
  await queries.ensureQueryData(storeQuery(client));
}
