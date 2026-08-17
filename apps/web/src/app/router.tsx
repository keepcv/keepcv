import { careerRecordKindSchema, uuidSchema } from "@keepcv/schema";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import { z } from "zod";
import { RecordDetail } from "../features/records/ui/record-detail.js";
import { RecordList } from "../features/records/ui/record-list.js";
import { SearchResults } from "../features/search/ui/search-results.js";
import { prefetchStore, useStore } from "../features/store/api/use-store.js";
import { Overview } from "../features/store/ui/overview.js";
import type { ApiClient } from "../lib/api.js";
import { Shell } from "./shell.js";
import { Failure, Skeleton } from "./states.js";

export interface RouterContext {
  queries: QueryClient;
  api: ApiClient;
}

// One loader, on the root: the shell navigates by what the store holds, so every
// screen under it reads the same one payload (application-structure.md #4).
const rootRoute = createRootRouteWithContext<RouterContext>()({
  loader: async ({ context }) => {
    await prefetchStore(context.queries, context.api);
  },
  component: function Frame() {
    return <Shell store={useStore(rootRoute.useRouteContext().api)} />;
  },
  errorComponent: ({ error }) => <Failure error={error} />,
  pendingComponent: () => <Skeleton rows={4} />,
});

// Filters live in the URL, not in component state (application-structure.md #3).
const recordSearchSchema = z.object({
  kind: careerRecordKindSchema.optional(),
  archived: z.enum(["exclude", "include", "only"]).default("exclude"),
});

const searchSchema = z.object({
  q: z.string().default(""),
  archived: z.boolean().default(false),
});

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: function OverviewScreen() {
    const store = useStore(overviewRoute.useRouteContext().api);
    return <Overview store={store} asOf={new Date().toISOString()} />;
  },
});

const recordsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/records",
  validateSearch: recordSearchSchema,
  component: function RecordsScreen() {
    const store = useStore(recordsRoute.useRouteContext().api);
    const { kind, archived } = recordsRoute.useSearch();
    return <RecordList store={store} filters={{ kind, archived }} />;
  },
});

const recordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/records/$recordId",
  params: { parse: ({ recordId }) => ({ recordId: uuidSchema.parse(recordId) }) },
  component: function RecordScreen() {
    const store = useStore(recordRoute.useRouteContext().api);
    return <RecordDetail store={store} recordId={recordRoute.useParams().recordId} />;
  },
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  validateSearch: searchSchema,
  component: function SearchScreen() {
    const store = useStore(searchRoute.useRouteContext().api);
    const { q, archived } = searchRoute.useSearch();
    return <SearchResults store={store} filters={{ q, archived }} />;
  },
});

const routeTree = rootRoute.addChildren([overviewRoute, recordsRoute, recordRoute, searchRoute]);

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
