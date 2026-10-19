import type { SavedFilterRepository, UnitOfWork } from "@keepcv/core";
import {
  filterSubjectSchema,
  savedFilterInputSchema,
  savedFilterPatchSchema,
  savedFilterSchema,
  type Uuid,
} from "@keepcv/schema";
import type { Context } from "hono";
import { mutate } from "../problems.js";
import { forRequest } from "../request-unit-of-work.js";
import { router } from "../router.js";
import { archivedQuery, collectionRoutes } from "./collection.js";

const filters = collectionRoutes({
  path: "/v1/saved-filters",
  tag: "saved filters",
  noun: "saved filter",
  dto: savedFilterSchema,
  input: savedFilterInputSchema,
  patch: savedFilterPatchSchema,
  query: archivedQuery.extend({ subject: filterSubjectSchema.optional() }),
});

export function savedFilterRoutes(unitOfWork: UnitOfWork) {
  const on = async <T>(c: Context, work: (of: SavedFilterRepository) => Promise<T>): Promise<T> =>
    await forRequest(unitOfWork, c).run(async (r) => await work(r.savedFilters));

  const read = async (c: Context, id: Uuid) => await on(c, async (of) => await of.get(id));

  return router()
    .openapi(filters.list, async (c) => {
      const { archived, subject } = c.req.valid("query");
      const items = await on(
        c,
        async (of) => await of.list({ subject, includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(filters.create, async (c) => {
      return c.json(await on(c, async (of) => await of.create(c.req.valid("json"))), 201);
    })
    .openapi(filters.read, async (c) => {
      return c.json(await read(c, c.req.valid("param").id), 200);
    })
    .openapi(filters.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(c, async (of) => await of.update(id, patch, expectedUpdatedAt)),
        async () => await read(c, id),
      );
      return c.json(updated, 200);
    })
    .openapi(filters.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(c, async (of) => await of.archive(id, expectedUpdatedAt)),
        async () => await read(c, id),
      );
      return c.json(archived, 200);
    })
    .openapi(filters.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(c, async (of) => await of.restore(id, expectedUpdatedAt)),
        async () => await read(c, id),
      );
      return c.json(restored, 200);
    });
}
