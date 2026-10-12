import type { ApiClient } from "@keepcv/api";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { type JSX, useMemo } from "react";
import { buildRouter } from "./app/router.js";
import type { DataPagePresentation } from "./features/data/model/presentation.js";

export type { DataPagePresentation } from "./features/data/model/presentation.js";

export interface EditorProps {
  api: ApiClient;
  queries: QueryClient;
  signOut?: (() => void) | undefined;
  dataPage?: DataPagePresentation | undefined;
  recoveryNamespace?: string | undefined;
}

export function Editor({
  api,
  queries,
  signOut,
  dataPage,
  recoveryNamespace,
}: EditorProps): JSX.Element {
  const router = useMemo(
    () => buildRouter({ api, queries, signOut, dataPage, recoveryNamespace }),
    [api, queries, signOut, dataPage, recoveryNamespace],
  );
  return (
    <QueryClientProvider client={queries}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
