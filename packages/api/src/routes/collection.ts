import { createRoute } from "@hono/zod-openapi";
import { timestampSchema, uuidSchema } from "@keepcv/schema";
import { z } from "zod";
import { jsonResponse, problemResponse, sessionRequired } from "../router.js";

// In the body, not `If-Unmodified-Since`: that header has second granularity
// and `updated_at` is milliseconds, so half of every comparison would match
// wrongly.
const expectedUpdatedAt = timestampSchema;

export const basedOn = z.object({ expectedUpdatedAt });

// Beside the patch, not merged into it: a record's patch is a discriminated
// union with no key to extend, and a patch key could shadow the token.
export function patchBody<Schema extends z.ZodType>(schema: Schema) {
  return z.object({ expectedUpdatedAt, patch: schema });
}

export const idParam = z.object({ id: uuidSchema });

export function jsonBody<Schema extends z.ZodType>(schema: Schema) {
  return { content: { "application/json": { schema } } };
}

export const archivedQuery = z.object({
  archived: z.enum(["exclude", "include"]).default("exclude"),
});

// Good enough for these nouns: no "hour" or "university" to break the rule.
function article(noun: string): string {
  return "aeiou".includes(noun[0] ?? "") ? "an" : "a";
}

export interface CollectionSpec<
  Path extends string,
  Dto extends z.ZodType,
  Input extends z.ZodType,
  Patch extends z.ZodType,
  Query extends z.ZodObject,
> {
  path: Path;
  tag: string;
  noun: string;
  dto: Dto;
  input: Input;
  patch: Patch;
  query: Query;
}

// Declarations only, never handlers: Hono derives handler types through
// conditionals TypeScript defers while the schema is a type parameter.
export function collectionRoutes<
  Path extends string,
  Dto extends z.ZodType,
  Input extends z.ZodType,
  Patch extends z.ZodType,
  Query extends z.ZodObject,
>(spec: CollectionSpec<Path, Dto, Input, Patch, Query>) {
  const { path, tag, noun, dto, input, patch, query } = spec;
  const item = `${path}/{id}` as const;
  const tags = [tag];
  const a = article(noun);
  const notFound = problemResponse(`no ${noun} of this owner has that id`);
  const stale = problemResponse(`the ${noun} changed after it was read`);

  return {
    list: createRoute({
      method: "get",
      path,
      tags,
      summary: `List ${tag}`,
      request: { query },
      responses: {
        ...sessionRequired,
        200: jsonResponse(z.object({ items: z.array(dto) }), `the ${tag}, in a stable order`),
        422: problemResponse("a filter names something this collection cannot be narrowed by"),
      },
    }),

    create: createRoute({
      method: "post",
      path,
      tags,
      summary: `Add ${a} ${noun}`,
      description: "The id comes from the client, so a retried create cannot duplicate a row.",
      request: { body: jsonBody(input) },
      responses: {
        ...sessionRequired,
        201: jsonResponse(dto, `the ${noun} as stored`),
        409: problemResponse("the id or the sort key is already taken"),
        422: problemResponse(`the body is not a valid ${noun}`),
      },
    }),

    read: createRoute({
      method: "get",
      path: item,
      tags,
      summary: `Read one ${noun}, archived or not`,
      request: { params: idParam },
      responses: { ...sessionRequired, 200: jsonResponse(dto, `the ${noun}`), 404: notFound },
    }),

    update: createRoute({
      method: "patch",
      path: item,
      tags,
      summary: `Update ${a} ${noun}`,
      description: "Absent leaves a field alone; an explicit null clears it.",
      request: { params: idParam, body: jsonBody(patchBody(patch)) },
      responses: {
        ...sessionRequired,
        200: jsonResponse(dto, `the ${noun} as stored`),
        404: notFound,
        409: problemResponse(`the ${noun} changed after it was read, or the sort key is taken`),
        422: problemResponse(`the body is not a valid ${noun} patch`),
      },
    }),

    archive: createRoute({
      method: "delete",
      path: item,
      tags,
      summary: `Archive ${a} ${noun}`,
      description: "Archives it. Nothing the user wrote is destroyed and the row stays readable.",
      request: { params: idParam, body: jsonBody(basedOn) },
      responses: {
        ...sessionRequired,
        200: jsonResponse(dto, `the ${noun}, now archived`),
        404: notFound,
        409: stale,
      },
    }),

    restore: createRoute({
      method: "post",
      path: `${item}/restore`,
      tags,
      summary: `Restore an archived ${noun}`,
      request: { params: idParam, body: jsonBody(basedOn) },
      responses: {
        ...sessionRequired,
        200: jsonResponse(dto, `the ${noun}, no longer archived`),
        404: notFound,
        409: stale,
      },
    }),
  };
}
