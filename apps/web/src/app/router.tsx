import { careerRecordKindSchema } from "@keepcv/schema";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import { z } from "zod";
import { RecordList } from "../features/records/ui/record-list.js";
import { prefetchStore, useStore } from "../features/store/api/use-store.js";
import { Overview } from "../features/store/ui/overview.js";
import type { ApiClient } from "../lib/api.js";
import { Shell } from "./shell.js";
import { Failure, Skeleton } from "./states.js";

export interface RouterContext {
  queries: QueryClient;
  api: ApiClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Shell,
  errorComponent: ({ error }) => <Failure error={error} />,
  pendingComponent: () => <Skeleton rows={4} />,
});

// Filters live in the URL, not in component state: a filtered view you can
// bookmark and reach again through browser history is what returning after
// ninety days needs (application-structure.md #3).
const recordSearchSchema = z.object({
  kind: careerRecordKindSchema.optional(),
  archived: z.enum(["exclude", "include", "only"]).default("exclude"),
});

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  loader: async ({ context }) => {
    await prefetchStore(context.queries, context.api);
  },
  component: function OverviewScreen() {
    const store = useStore(overviewRoute.useRouteContext().api);
    return <Overview store={store} asOf={new Date().toISOString()} />;
  },
});

const recordsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/records",
  validateSearch: recordSearchSchema,
  loader: async ({ context }) => {
    await prefetchStore(context.queries, context.api);
  },
  component: function RecordsScreen() {
    const store = useStore(recordsRoute.useRouteContext().api);
    const { kind, archived } = recordsRoute.useSearch();
    return <RecordList store={store} filters={{ kind, archived }} />;
  },
});

const routeTree = rootRoute.addChildren([overviewRoute, recordsRoute]);

export function buildRouter(context: RouterContext) {
  return createRouter({
    routeTree,
    context,
    defaultPendingComponent: () => <Skeleton rows={4} />,
    defaultErrorComponent: ({ error }) => <Failure error={error} />,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof buildRouter>;
  }
}
