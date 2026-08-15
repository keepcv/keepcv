import type { OrganisationRepository, UnitOfWork } from "@keepcv/core";
import {
  organisationInputSchema,
  organisationPatchSchema,
  organisationSchema,
  type Uuid,
} from "@keepcv/schema";
import { mutate } from "../problems.js";
import { router } from "../router.js";
import { archivedQuery, collectionRoutes } from "./collection.js";

const routes = collectionRoutes({
  path: "/v1/organisations",
  tag: "organisations",
  noun: "organisation",
  dto: organisationSchema,
  input: organisationInputSchema,
  patch: organisationPatchSchema,
  query: archivedQuery,
});

export function organisationRoutes(unitOfWork: UnitOfWork) {
  const on = async <T>(work: (of: OrganisationRepository) => Promise<T>): Promise<T> =>
    await unitOfWork.run(async (r) => await work(r.organisations));
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
