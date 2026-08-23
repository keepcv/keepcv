import { careerRecordKindSchema, uuidSchema } from "@keepcv/schema";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import { z } from "zod";
import { DataScreen } from "../features/data/ui/data-screen.js";
import { ImportScreen } from "../features/import/ui/import-screen.js";
import { POINT_FILTERS } from "../features/points/model/point-rows.js";
import { MissingPoint, PointForm } from "../features/points/ui/point-form.js";
import { PointList } from "../features/points/ui/point-list.js";
import { PointScreen } from "../features/points/ui/point-screen.js";
import { ProfileScreen } from "../features/profile/ui/profile-screen.js";
import { MissingRecord, RecordDetail } from "../features/records/ui/record-detail.js";
import { RecordForm } from "../features/records/ui/record-form.js";
import { RecordList } from "../features/records/ui/record-list.js";
import { RESUME_VIEWS, ResumeDetailScreen } from "../features/resumes/ui/resume-detail.js";
import { ResumeList } from "../features/resumes/ui/resume-list.js";
import { SearchResults } from "../features/search/ui/search-results.js";
import { SectionList } from "../features/sections/ui/section-list.js";
import { Overview } from "../features/store/ui/overview.js";
import { TAG_FILTERS } from "../features/tags/model/tag-rows.js";
import { TagList } from "../features/tags/ui/tag-list.js";
import type { ApiClient } from "../lib/api.js";
import { ARCHIVED_FILTERS } from "../lib/archived.js";
import { prefetchStore, useStore } from "../lib/store-cache.js";
import { Shell } from "./shell.js";
import { Failure, Skeleton } from "./states.js";

export interface RouterContext {
  queries: QueryClient;
  api: ApiClient;
  // Undefined when there is nothing to sign out of, which is every mode but
  // one: the navigation asks whether signing out is a thing here, not which
  // mode the launcher is in.
  signOut: (() => void) | undefined;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  loader: async ({ context }) => {
    await prefetchStore(context.queries, context.api);
  },
  component: function Frame() {
    const { api, signOut } = rootRoute.useRouteContext();
    return <Shell store={useStore(api)} onSignOut={signOut} />;
  },
  errorComponent: ({ error }) => <Failure error={error} />,
  pendingComponent: () => <Skeleton rows={4} />,
});

const recordSearchSchema = z.object({
  kind: careerRecordKindSchema.optional(),
  tag: uuidSchema.optional(),
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

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: function ProfilePage() {
    const { api } = profileRoute.useRouteContext();
    return <ProfileScreen store={useStore(api)} client={api} />;
  },
});

const dataRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/data",
  component: function DataPage() {
    const { api } = dataRoute.useRouteContext();
    return <DataScreen store={useStore(api)} client={api} />;
  },
});

const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import",
  component: function ImportPage() {
    const { api } = importRoute.useRouteContext();
    return <ImportScreen store={useStore(api)} client={api} />;
  },
});

const recordsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/records",
  validateSearch: recordSearchSchema,
  component: function RecordsScreen() {
    const { api } = recordsRoute.useRouteContext();
    const { kind, tag, archived } = recordsRoute.useSearch();
    return (
      <RecordList store={useStore(api)} client={api} filters={{ kind, tagId: tag, archived }} />
    );
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
  validateSearch: z.object({
    filter: z.enum(POINT_FILTERS).default("all"),
    tag: uuidSchema.optional(),
  }),
  component: function PointsScreen() {
    const { api } = pointsRoute.useRouteContext();
    const { filter, tag } = pointsRoute.useSearch();
    return <PointList store={useStore(api)} client={api} filters={{ filter, tagId: tag }} />;
  },
});

const tagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tags",
  validateSearch: z.object({ filter: z.enum(TAG_FILTERS).default("all") }),
  component: function TagsScreen() {
    const { api } = tagsRoute.useRouteContext();
    return <TagList store={useStore(api)} client={api} filter={tagsRoute.useSearch().filter} />;
  },
});

const sectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sections",
  validateSearch: z.object({ archived: z.boolean().default(false) }),
  component: function SectionsScreen() {
    const { api } = sectionsRoute.useRouteContext();
    return (
      <SectionList
        store={useStore(api)}
        client={api}
        archived={sectionsRoute.useSearch().archived}
      />
    );
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
    const { api } = resumesRoute.useRouteContext();
    return (
      <ResumeList store={useStore(api)} client={api} archived={resumesRoute.useSearch().archived} />
    );
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
  profileRoute,
  dataRoute,
  importRoute,
  recordsRoute,
  newRecordRoute,
  recordRoute,
  editRecordRoute,
  pointsRoute,
  newPointRoute,
  editPointRoute,
  tagsRoute,
  sectionsRoute,
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
