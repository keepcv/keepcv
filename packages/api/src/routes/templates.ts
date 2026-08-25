import type { TemplateRepository, UnitOfWork } from "@keepcv/core";
import {
  templateInputSchema,
  templatePatchSchema,
  templateSchema,
  type Uuid,
} from "@keepcv/schema";
import { mutate } from "../problems.js";
import { router } from "../router.js";
import { archivedQuery, collectionRoutes } from "./collection.js";

// The shipped designs are in every build rather than in the store, so this
// answers only the ones the user wrote.
const routes = collectionRoutes({
  path: "/v1/templates",
  tag: "templates",
  noun: "template",
  dto: templateSchema,
  input: templateInputSchema,
  patch: templatePatchSchema,
  query: archivedQuery,
});

export function templateRoutes(unitOfWork: UnitOfWork) {
  const on = async <T>(work: (of: TemplateRepository) => Promise<T>): Promise<T> =>
    await unitOfWork.run(async (r) => await work(r.templates));
  const read = async (id: Uuid) => await on(async (of) => await of.get(id));

  return router()
    .openapi(routes.list, async (c) => {
      const { archived } = c.req.valid("query");
      const items = await on(
        async (of) => await of.list({ includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(routes.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.create(input)), 201);
    })
    .openapi(routes.read, async (c) => {
      return c.json(await read(c.req.valid("param").id), 200);
    })
    .openapi(routes.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.update(id, patch, expectedUpdatedAt)),
        async () => await read(id),
      );
      return c.json(updated, 200);
    })
    .openapi(routes.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archive(id, expectedUpdatedAt)),
        async () => await read(id),
      );
      return c.json(archived, 200);
    })
    .openapi(routes.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restore(id, expectedUpdatedAt)),
        async () => await read(id),
      );
      return c.json(restored, 200);
    });
}
