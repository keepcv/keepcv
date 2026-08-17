import type { Store } from "@keepcv/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { addRecord, emptyStore } from "../store.harness.js";
import { STORE_KEY, useStoreMutation } from "./store-cache.js";

function withCache(store: Store) {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queries.setQueryData(STORE_KEY, store);

  return {
    titleInCache: () => queries.getQueryData<Store>(STORE_KEY)?.records[0]?.title,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queries}>{children}</QueryClientProvider>
    ),
  };
}

describe("an optimistic write", () => {
  it("shows the row before the response, and puts the cache back when it is refused", async () => {
    const store = emptyStore();
    addRecord(store, { title: "Difference Engine" });
    const cache = withCache(store);

    let refuse = (): void => {
      throw new Error("the request was never made");
    };
    const { result } = renderHook(
      () =>
        useStoreMutation<string, void>({
          send: async () =>
            await new Promise<void>((_resolve, reject) => {
              refuse = () => {
                reject(new Error("the store refused it"));
              };
            }),
          optimistic: (current, title) => ({
            ...current,
            records: current.records.map((row) => ({ ...row, title })),
          }),
        }),
      { wrapper: cache.wrapper },
    );

    result.current.mutate("Analytical Engine");
    await waitFor(() => {
      expect(cache.titleInCache()).toBe("Analytical Engine");
    });

    // Without the rollback the screen keeps claiming a write that never landed,
    // and goes on claiming it if the re-read fails too.
    refuse();
    await waitFor(() => {
      expect(cache.titleInCache()).toBe("Difference Engine");
    });
  });
});
