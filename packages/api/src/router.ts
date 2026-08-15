import { OpenAPIHono } from "@hono/zod-openapi";
import { problemSchema } from "@keepcv/schema";
import type { z } from "zod";

// Validation failures are thrown rather than answered here, so they reach
// `onError` and come back in the one problem+json shape every error uses. Hono's
// own default is a bare 400 with a text body, which the client cannot type.
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

// Everything under /v1 sits behind the session guard, so every route can answer
// this and repeating it per definition would bury the interesting responses.
export const sessionRequired = {
  401: problemResponse("no session token was presented, or the wrong one"),
};
