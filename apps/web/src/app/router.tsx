import { careerRecordKindSchema, uuidSchema } from "@keepcv/schema";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import { z } from "zod";
import { POINT_FILTERS } from "../features/points/model/point-rows.js";
import { MissingPoint, PointForm } from "../features/points/ui/point-form.js";
import { PointList } from "../features/points/ui/point-list.js";
import { PointScreen } from "../features/points/ui/point-screen.js";
import { MissingRecord, RecordDetail } from "../features/records/ui/record-detail.js";
import { RecordForm } from "../features/records/ui/record-form.js";
import { RecordList } from "../features/records/ui/record-list.js";
import { RESUME_VIEWS, ResumeDetailScreen } from "../features/resumes/ui/resume-detail.js";
import { ResumeList } from "../features/resumes/ui/resume-list.js";
import { SearchResults } from "../features/search/ui/search-results.js";
import { Overview } from "../features/store/ui/overview.js";
import type { ApiClient } from "../lib/api.js";
import { ARCHIVED_FILTERS } from "../lib/archived.js";
import { prefetchStore, useStore } from "../lib/store-cache.js";
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
  archived: z.enum(ARCHIVED_FILTERS).default("exclude"),
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

// Before the parameterised one: "new" is a screen, not a record id.
const newRecordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/records/new",
  validateSearch: z.object({ kind: careerRecordKindSchema.default("experience") }),
  component: function NewRecordScreen() {
    const { api } = newRecordRoute.useRouteContext();
    return <RecordForm store={useStore(api)} client={api} kind={newRecordRoute.useSearch().kind} />;
  },
});

const recordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/records/$recordId",
  params: { parse: ({ recordId }) => ({ recordId: uuidSchema.parse(recordId) }) },
  component: function RecordScreen() {
    const { api } = recordRoute.useRouteContext();
    return (
      <RecordDetail
        store={useStore(api)}
        client={api}
        recordId={recordRoute.useParams().recordId}
      />
    );
  },
});

const editRecordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/records/$recordId/edit",
  params: { parse: ({ recordId }) => ({ recordId: uuidSchema.parse(recordId) }) },
  component: function EditRecordScreen() {
    const { api } = editRecordRoute.useRouteContext();
    const store = useStore(api);
    const { recordId } = editRecordRoute.useParams();
    const record = store.records.find((row) => row.id === recordId);

    if (record === undefined) return <MissingRecord />;
    return <RecordForm store={store} client={api} record={record} kind={record.kind} />;
  },
});

const pointsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/points",
  validateSearch: z.object({ filter: z.enum(POINT_FILTERS).default("all") }),
  component: function PointsScreen() {
    const store = useStore(pointsRoute.useRouteContext().api);
    return <PointList store={store} filter={pointsRoute.useSearch().filter} />;
  },
});

const newPointRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/points/new",
  validateSearch: z.object({ recordId: uuidSchema.optional() }),
  component: function NewPointScreen() {
    const { api } = newPointRoute.useRouteContext();
    const { recordId } = newPointRoute.useSearch();
    return (
      <PointForm
        store={useStore(api)}
        client={api}
        {...(recordId === undefined ? {} : { recordId })}
      />
    );
  },
});

const editPointRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/points/$pointId/edit",
  params: { parse: ({ pointId }) => ({ pointId: uuidSchema.parse(pointId) }) },
  component: function EditPointScreen() {
    const { api } = editPointRoute.useRouteContext();
    const store = useStore(api);
    const { pointId } = editPointRoute.useParams();
    const point = store.points.find((row) => row.id === pointId);

    if (point === undefined) return <MissingPoint />;
    return <PointScreen store={store} client={api} point={point} />;
  },
});

const resumesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/resumes",
  validateSearch: z.object({ archived: z.enum(ARCHIVED_FILTERS).default("exclude") }),
  component: function ResumesScreen() {
    const store = useStore(resumesRoute.useRouteContext().api);
    return <ResumeList store={store} archived={resumesRoute.useSearch().archived} />;
  },
});

const resumeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/resumes/$resumeId",
  params: { parse: ({ resumeId }) => ({ resumeId: uuidSchema.parse(resumeId) }) },
  validateSearch: z.object({ view: z.enum(RESUME_VIEWS).default("composition") }),
  component: function ResumeScreen() {
    const { api } = resumeRoute.useRouteContext();
    return (
      <ResumeDetailScreen
        store={useStore(api)}
        client={api}
        resumeId={resumeRoute.useParams().resumeId}
        view={resumeRoute.useSearch().view}
        asOf={new Date().toISOString()}
      />
    );
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

const routeTree = rootRoute.addChildren([
  overviewRoute,
  recordsRoute,
  newRecordRoute,
  recordRoute,
  editRecordRoute,
  pointsRoute,
  newPointRoute,
  editPointRoute,
  resumesRoute,
  resumeRoute,
  searchRoute,
]);

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
