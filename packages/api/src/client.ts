import { hc } from "hono/client";
import type { Api } from "./api.js";
import { SESSION_TOKEN_HEADER } from "./auth.js";

// Built here rather than in each consumer: `hc<Api>` resolves the route types
// once, inside the package that declares them, so a client does not re-infer a
// type that large across a package boundary.
export type ApiClient = ReturnType<typeof hc<Api>>;

export function createClient(baseUrl: string, options: { sessionToken?: string } = {}): ApiClient {
  const headers =
    options.sessionToken === undefined ? {} : { [SESSION_TOKEN_HEADER]: options.sessionToken };
  return hc<Api>(baseUrl, { headers });
}
