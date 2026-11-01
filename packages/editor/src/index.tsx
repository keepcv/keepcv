import type { ApiClient } from "@keepcv/api";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { type JSX, useMemo } from "react";
import { buildRouter } from "./app/router.js";
import type { DataPagePresentation } from "./features/data/model/presentation.js";

export type { DataPagePresentation } from "./features/data/model/presentation.js";

export interface EditorProps {
  api: ApiClient;
  assistant?: boolean;
  home?: "assistant" | "overview";
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
  assistant,
  home,
}: EditorProps): JSX.Element {
  const router = useMemo(
    () => buildRouter({ api, queries, signOut, dataPage, recoveryNamespace, assistant, home }),
    [api, queries, signOut, dataPage, recoveryNamespace, assistant, home],
  );
  return (
    <QueryClientProvider client={queries}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
