import type { ApiClient } from "@keepcv/api";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { type JSX, useMemo } from "react";
import { buildRouter } from "./app/router.js";

export interface EditorProps {
  api: ApiClient;
  queries: QueryClient;
  signOut?: (() => void) | undefined;
}

export function Editor({ api, queries, signOut }: EditorProps): JSX.Element {
  const router = useMemo(() => buildRouter({ api, queries, signOut }), [api, queries, signOut]);
  return (
    <QueryClientProvider client={queries}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
