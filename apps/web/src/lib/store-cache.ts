import { type Store, storeSchema, type Timestamp, type Uuid } from "@keepcv/schema";
import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { type ApiClient, unwrap } from "./api.js";

export const STORE_KEY = ["store"] as const;

// What an optimistic row claims until the answer arrives with the real one.
export function now(): Timestamp {
  return new Date().toISOString() as Timestamp;
}

// Every optimistic write puts one row into one collection, and a create puts
// one there the payload did not have yet.
export function replaceRow<T extends { id: Uuid }>(rows: readonly T[], row: T): T[] {
  return rows.some((existing) => existing.id === row.id)
    ? rows.map((existing) => (existing.id === row.id ? row : existing))
    : [...rows, row];
}

// One request boots the app. Only this client writes, so it stays fresh until a
// mutation says otherwise.
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

// Ids are minted on the client, so the optimistic row is the one the store
// keeps. `settle` writes the answer back rather than re-reading the whole
// payload.
export function useStoreMutation<Variables, Result>(options: {
  send: (variables: Variables) => Promise<Result>;
  optimistic: (store: Store, variables: Variables) => Store;
  settle?: (store: Store, result: Result) => Store;
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
    onSuccess: (result) => {
      const settle = options.settle;
      const current = queries.getQueryData<Store>(STORE_KEY);
      if (settle === undefined || current === undefined) return;
      queries.setQueryData(STORE_KEY, settle(current, result));
    },
    onError: (_error, _variables, previous) => {
      if (previous !== undefined) queries.setQueryData(STORE_KEY, previous);
    },
    onSettled: async (_result, error) => {
      if (options.settle !== undefined && error === null) return;
      await queries.invalidateQueries({ queryKey: STORE_KEY });
    },
  });
}
