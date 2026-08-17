import { type Store, storeSchema } from "@keepcv/schema";
import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { type ApiClient, unwrap } from "./api.js";

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

// Ids are minted on the client, so the row a screen shows before the response
// arrives is the row the store ends up holding (application-structure.md #4).
export function useStoreMutation<Variables, Result>(options: {
  send: (variables: Variables) => Promise<Result>;
  optimistic: (store: Store, variables: Variables) => Store;
}) {
  const queries = useQueryClient();

  return useMutation<Result, unknown, Variables, Store | undefined>({
    mutationFn: options.send,
    onMutate: async (variables) => {
      await queries.cancelQueries({ queryKey: STORE_KEY });
      const previous = queries.getQueryData<Store>(STORE_KEY);
      if (previous !== undefined) {
        queries.setQueryData(STORE_KEY, options.optimistic(previous, variables));
      }
      return previous;
    },
    onError: (_error, _variables, previous) => {
      if (previous !== undefined) queries.setQueryData(STORE_KEY, previous);
    },
    onSettled: async () => {
      await queries.invalidateQueries({ queryKey: STORE_KEY });
    },
  });
}
