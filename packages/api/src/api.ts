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
import { storeRoutes } from "./routes/store.js";
import { tagRoutes } from "./routes/tags.js";

export const OPENAPI_PATH = "/v1/openapi.json";

export interface ApiOptions {
  unitOfWork: UnitOfWork;
  // The scope every repository call reads its owner from. The implementation
  // supplies it - @keepcv/db uses AsyncLocalStorage - so nothing here depends on
  // a driver, and the private cloud adapter brings its own (api-contract.md #4).
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
    // The document describes the contract and tooling fetches it before it has a
    // token, so it is the one thing under /v1 outside the guard.
    if (c.req.path === OPENAPI_PATH) {
      await next();
      return;
    }
    const ownerId = await authenticate(c.req.raw);
    if (ownerId === undefined) {
      throw new UnauthorizedError();
    }
    // Entered once per request, so every repository call underneath is scoped by
    // construction rather than by each handler remembering to.
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

  // Hono's own 404 is an empty text body, which a client cannot tell apart from
  // a route that answered nothing.
  app.notFound((c) =>
    answer({
      type: PROBLEM_TYPES.notFound,
      title: "Not found",
      status: 404,
      detail: `No route handles ${c.req.method} ${c.req.path}.`,
      instance: c.req.path,
    }),
  );

  // Chained rather than mounted one per statement: the typed client is built
  // from this return type, and Hono accumulates route types only along a chain.
  return app
    .route("/", profileRoutes(options.unitOfWork))
    .route("/", organisationRoutes(options.unitOfWork))
    .route("/", customSectionRoutes(options.unitOfWork))
    .route("/", recordRoutes(options.unitOfWork))
    .route("/", pointRoutes(options.unitOfWork))
    .route("/", phrasingRoutes(options.unitOfWork))
    .route("/", tagRoutes(options.unitOfWork))
    .route("/", draftRoutes(options.unitOfWork))
    .route("/", storeRoutes(options.unitOfWork));
}

export type Api = ReturnType<typeof createApi>;
