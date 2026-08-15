import { createRoute } from "@hono/zod-openapi";
import type { UnitOfWork } from "@keepcv/core";
import {
  CURRENT_SCHEMA_VERSION,
  type ExportDocument,
  exportDocumentSchema,
  migrateDocument,
  storeSchema,
  timestampSchema,
} from "@keepcv/schema";
import { z } from "zod";
import { jsonResponse, problemResponse, router, sessionRequired } from "../router.js";

// One format today, and a named one rather than none: `?format=jsonresume` has
// to fail rather than quietly hand back native data under the wrong name.
const formatQuery = z.object({ format: z.enum(["native"]).default("native") });

// Deliberately not `exportDocumentSchema`, which pins the current version: a
// document written by an older build is exactly what import exists to accept,
// and `migrateDocument` brings it forward before anything is validated.
const anyVersion = z.looseObject({ schemaVersion: z.number().int() });

// The whole store is kilobytes, so the client fetches this once on boot and
// reads most screens out of it with selectors rather than a request per list.
// Archived rows come too: filtering them is the client's to do, and refetching
// to answer "where did my old entry go" is what hiding them would cost.
const readStore = createRoute({
  method: "get",
  path: "/v1/store",
  tags: ["store"],
  summary: "Read the whole store as it stands",
  description:
    "Current state, so `phrasingRevisions` carries only the revision each phrasing points at now. Superseded wordings are fetched per phrasing, and are all in the export.",
  responses: {
    ...sessionRequired,
    200: jsonResponse(storeSchema, "every row this owner has, history excluded"),
  },
});

const exportStore = createRoute({
  method: "get",
  path: "/v1/export",
  tags: ["store"],
  summary: "Export the whole store, losslessly",
  description:
    "Every row this owner has, archived ones and superseded wordings included. Never gated by any account, licence or entitlement state.",
  request: { query: formatQuery },
  responses: {
    ...sessionRequired,
    200: jsonResponse(exportDocumentSchema, "the export document"),
    422: problemResponse("that format is not one this build writes"),
  },
});

const importStore = createRoute({
  method: "post",
  path: "/v1/import",
  tags: ["store"],
  summary: "Load a native export into an empty store",
  description:
    "All or nothing, and only into a store nobody has written to yet. Merging two stores needs a review step in front of it, which is what the lossy-format import flow is for.",
  request: {
    query: formatQuery,
    body: { content: { "application/json": { schema: anyVersion } } },
  },
  responses: {
    ...sessionRequired,
    204: { description: "the store was loaded" },
    409: problemResponse("the store already holds something"),
    422: problemResponse("the document is malformed, or its schema version has no way forward"),
  },
});

export function storeRoutes(unitOfWork: UnitOfWork) {
  return router()
    .openapi(readStore, async (c) => {
      return c.json(await unitOfWork.run(async (r) => await r.store.readCurrent()), 200);
    })
    .openapi(exportStore, async (c) => {
      const store = await unitOfWork.run(async (r) => await r.store.read());
      // The envelope belongs to the file rather than the repository: the store
      // knows nothing about when it was written out (api-contract.md #4).
      const document: ExportDocument = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        exportedAt: timestampSchema.parse(new Date().toISOString()),
        store,
      };
      return c.json(document, 200);
    })
    .openapi(importStore, async (c) => {
      const document = migrateDocument(c.req.valid("json"));
      await unitOfWork.run(async (r) => {
        await r.store.load(document.store);
      });
      return c.body(null, 204);
    });
}
