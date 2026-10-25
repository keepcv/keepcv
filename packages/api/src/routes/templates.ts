import type { TemplateRepository, UnitOfWork } from "@keepcv/core";
import {
  templateInputSchema,
  templatePatchSchema,
  templateSchema,
  type Uuid,
} from "@keepcv/schema";
import { type TemplateType, validateTemplate } from "@keepcv/templates";
import type { Context } from "hono";
import { mutate } from "../problems.js";
import { forRequest } from "../request-unit-of-work.js";
import { router } from "../router.js";
import { archivedQuery, collectionRoutes } from "./collection.js";

export function templateRoutes(unitOfWork: UnitOfWork, types?: readonly TemplateType[]) {
  const spec = templateInputSchema.shape.spec.superRefine((value, context) => {
    try {
      validateTemplate(value, types);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid template.",
      });
    }
  });
  const routes = collectionRoutes({
    path: "/v1/templates",
    tag: "templates",
    noun: "template",
    dto: templateSchema,
    input: templateInputSchema.extend({ spec }),
    patch: templatePatchSchema.extend({ spec: spec.optional() }),
    query: archivedQuery,
  });
  const on = async <T>(c: Context, work: (of: TemplateRepository) => Promise<T>): Promise<T> =>
    await forRequest(unitOfWork, c).run(async (r) => await work(r.templates));
  const read = async (c: Context, id: Uuid) => await on(c, async (of) => await of.get(id));

  return router()
    .openapi(routes.list, async (c) => {
      const { archived } = c.req.valid("query");
      const items = await on(
        c,
        async (of) => await of.list({ includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(routes.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(c, async (of) => await of.create(input)), 201);
    })
    .openapi(routes.read, async (c) => {
      return c.json(await read(c, c.req.valid("param").id), 200);
    })
    .openapi(routes.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(c, async (of) => await of.update(id, patch, expectedUpdatedAt)),
        async () => await read(c, id),
      );
      return c.json(updated, 200);
    })
    .openapi(routes.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(c, async (of) => await of.archive(id, expectedUpdatedAt)),
        async () => await read(c, id),
      );
      return c.json(archived, 200);
    })
    .openapi(routes.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(c, async (of) => await of.restore(id, expectedUpdatedAt)),
        async () => await read(c, id),
      );
      return c.json(restored, 200);
    });
}
