import type { UnitOfWork } from "@keepcv/core";
import { PROBLEM_TYPES, type Problem, type Uuid } from "@keepcv/schema";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Authenticate } from "./auth.js";
import { problemFor, UnauthorizedError } from "./problems.js";
import { router } from "./router.js";
import { customSectionRoutes } from "./routes/custom-sections.js";
import { draftRoutes } from "./routes/drafts.js";
import { organisationRoutes } from "./routes/organisations.js";
import { phrasingRoutes } from "./routes/phrasings.js";
import { pointRoutes } from "./routes/points.js";
import { profileRoutes } from "./routes/profile.js";
import { recordRoutes } from "./routes/records.js";
import { resumeRoutes } from "./routes/resumes.js";
import { storeRoutes } from "./routes/store.js";
import { tagRoutes } from "./routes/tags.js";
import { versionRoutes } from "./routes/versions.js";

export const OPENAPI_PATH = "/v1/openapi.json";

export interface ApiOptions {
  unitOfWork: UnitOfWork;
  // Supplied by the implementation, so nothing here depends on a driver.
  runAsOwner: <T>(ownerId: Uuid, work: () => Promise<T>) => Promise<T>;
  authenticate: Authenticate;
}

function answer(problem: Problem): Response {
  return new Response(JSON.stringify(problem), {
    status: problem.status as ContentfulStatusCode,
    headers: { "content-type": "application/problem+json" },
  });
}

export function createApi(options: ApiOptions) {
  const { authenticate, runAsOwner } = options;

  const app = router();

  app.use("/v1/*", async (c, next) => {
    // Tooling fetches this before it has a token, so it is outside the guard.
    if (c.req.path === OPENAPI_PATH) {
      await next();
      return;
    }
    const ownerId = await authenticate(c.req.raw);
    if (ownerId === undefined) {
      throw new UnauthorizedError();
    }
    // Entered once per request, so every call underneath is scoped by construction.
    await runAsOwner(ownerId, async () => {
      await next();
    });
  });

  app.doc31(OPENAPI_PATH, {
    openapi: "3.1.0",
    info: {
      title: "KeepCV",
      version: "1",
      description:
        "The boundary between a KeepCV client and its store. Self-hosted deployments routinely run mismatched client and server builds, so this document is the contract rather than a description of one build.",
    },
  });

  app.onError((error, c) => answer(problemFor(error, c.req.path)));

  // Hono's own 404 is an empty text body, which a client cannot type.
  app.notFound((c) =>
    answer({
      type: PROBLEM_TYPES.notFound,
      title: "Not found",
      status: 404,
      detail: `No route handles ${c.req.method} ${c.req.path}.`,
      instance: c.req.path,
    }),
  );

  // Chained, not mounted per statement: Hono accumulates route types only along
  // a chain, and the typed client is built from this return type.
  return app
    .route("/", profileRoutes(options.unitOfWork))
    .route("/", organisationRoutes(options.unitOfWork))
    .route("/", customSectionRoutes(options.unitOfWork))
    .route("/", recordRoutes(options.unitOfWork))
    .route("/", pointRoutes(options.unitOfWork))
    .route("/", phrasingRoutes(options.unitOfWork))
    .route("/", tagRoutes(options.unitOfWork))
    .route("/", resumeRoutes(options.unitOfWork))
    .route("/", versionRoutes(options.unitOfWork))
    .route("/", draftRoutes(options.unitOfWork))
    .route("/", storeRoutes(options.unitOfWork));
}

export type Api = ReturnType<typeof createApi>;
