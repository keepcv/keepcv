import { OpenAPIHono } from "@hono/zod-openapi";
import { problemSchema } from "@keepcv/schema";
import type { z } from "zod";

// Thrown rather than answered here, so they reach `onError` and come back as
// problem+json. Hono's default is a bare 400 with a text body.
export function router() {
  return new OpenAPIHono({
    defaultHook: (result) => {
      if (!result.success) {
        throw result.error;
      }
    },
  });
}

export function jsonResponse<Schema extends z.ZodType>(schema: Schema, description: string) {
  return { content: { "application/json": { schema } }, description };
}

export function problemResponse(description: string) {
  return { content: { "application/problem+json": { schema: problemSchema } }, description };
}

// Every route can answer this, so declaring it per route would bury the rest.
export const sessionRequired = {
  401: problemResponse("no session token was presented, or the wrong one"),
};
