import type { ApiClient } from "@keepcv/api";
import { newUuid } from "@keepcv/core";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { type JSX, useMemo } from "react";
import { buildRouter } from "./app/router.js";
import type { DataPagePresentation } from "./features/data/model/presentation.js";
import { type EditorPresentation, HostContext } from "./lib/host.js";

export type { DataPagePresentation } from "./features/data/model/presentation.js";

export type { EditorFailure, HostAction } from "./lib/host.js";

export interface EditorProps extends EditorPresentation {
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
  sizing = "viewport",
  hostActions,
  recoveryActions,
}: EditorProps): JSX.Element {
  const connection = useMemo(
    () => ({
      key: newUuid(),
      router: buildRouter({ api, queries, signOut: undefined, recoveryNamespace, assistant, home }),
    }),
    [api, queries, recoveryNamespace, assistant, home],
  );
  return (
    <HostContext.Provider value={{ sizing, hostActions, recoveryActions, signOut, dataPage }}>
      <div
        className={
          sizing === "container"
            ? "relative h-full min-h-0 overflow-x-hidden overflow-y-auto"
            : "relative h-dvh overflow-x-hidden overflow-y-auto"
        }
      >
        <QueryClientProvider client={queries}>
          <RouterProvider key={connection.key} router={connection.router} />
        </QueryClientProvider>
      </div>
    </HostContext.Provider>
  );
}
