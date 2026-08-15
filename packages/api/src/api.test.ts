import { PROBLEM_TYPES } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { problemOf, SESSION_TOKEN, withApi } from "./api.harness.js";
import { OPENAPI_PATH } from "./api.js";
import { SESSION_TOKEN_HEADER } from "./auth.js";

const { send, raw } = withApi();

describe("the session guard", () => {
  it("refuses a request carrying no token", async () => {
    const problem = await problemOf(await raw("/v1/profile"));
    expect(problem.status).toBe(401);
    expect(problem.type).toBe(PROBLEM_TYPES.unauthorized);
  });

  it("refuses a request carrying the wrong token", async () => {
    const response = await raw("/v1/profile", {
      headers: { [SESSION_TOKEN_HEADER]: `${SESSION_TOKEN}x` },
    });
    expect(response.status).toBe(401);
  });

  // The token names the owner, and the owner is never a parameter. A request
  // that got this far cannot ask for somebody else's rows.
  it("lets a request carrying the right token through", async () => {
    expect((await send("GET", "/v1/profile")).status).toBe(200);
  });
});

describe("problem responses", () => {
  it("answers an unknown route with a problem rather than an empty body", async () => {
    const problem = await problemOf(await send("GET", "/v1/nothing-here"));
    expect(problem.status).toBe(404);
    expect(problem.type).toBe(PROBLEM_TYPES.notFound);
    expect(problem.instance).toBe("/v1/nothing-here");
  });

  // Paths read the way the spec writes them, so a reader can find the offending
  // node without counting array elements.
  it("names every field a validation failure came from", async () => {
    const problem = await problemOf(
      await send("POST", "/v1/contact-channels", {
        id: "not-a-uuid",
        kind: "mastodon",
        label: null,
        value: "",
        isDefaultVisible: true,
        sortKey: "a0",
      }),
    );

    expect(problem.status).toBe(422);
    expect(problem.type).toBe(PROBLEM_TYPES.validationFailed);
    expect(problem.errors?.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(["id", "kind", "value"]),
    );
  });
});

describe("the OpenAPI document", () => {
  it("is served without a session token, because tooling has none yet", async () => {
    expect((await raw(OPENAPI_PATH)).status).toBe(200);
  });

  it("describes every route the API answers, from the same schemas", async () => {
    const document = (await (await raw(OPENAPI_PATH)).json()) as {
      paths: Record<string, Record<string, unknown>>;
      components: { schemas: Record<string, unknown> };
    };

    expect(Object.keys(document.paths).sort()).toEqual([
      "/v1/contact-channels",
      "/v1/contact-channels/{id}",
      "/v1/contact-channels/{id}/restore",
      "/v1/custom-sections",
      "/v1/custom-sections/{id}",
      "/v1/custom-sections/{id}/restore",
      "/v1/evidence",
      "/v1/evidence/{id}",
      "/v1/evidence/{id}/restore",
      "/v1/export",
      "/v1/import",
      "/v1/metrics",
      "/v1/metrics/{id}",
      "/v1/metrics/{id}/restore",
      "/v1/organisations",
      "/v1/organisations/{id}",
      "/v1/organisations/{id}/restore",
      "/v1/phrasing-sets",
      "/v1/phrasing-sets/{id}",
      "/v1/phrasing-sets/{id}/restore",
      "/v1/phrasings",
      "/v1/phrasings/{id}",
      "/v1/phrasings/{id}/restore",
      "/v1/phrasings/{id}/revisions",
      "/v1/points",
      "/v1/points/{id}",
      "/v1/points/{id}/records",
      "/v1/points/{id}/records/{recordId}",
      "/v1/points/{id}/restore",
      "/v1/profile",
      "/v1/record-fields",
      "/v1/record-fields/{id}",
      "/v1/record-fields/{id}/restore",
      "/v1/record-links",
      "/v1/record-links/{id}",
      "/v1/record-links/{id}/restore",
      "/v1/records",
      "/v1/records/{id}",
      "/v1/records/{id}/restore",
      "/v1/store",
    ]);
    expect(Object.keys(document.paths["/v1/contact-channels/{id}"] ?? {}).sort()).toEqual([
      "delete",
      "get",
      "patch",
    ]);

    // Named from `.meta({ id })` on the schema itself, so the document and the
    // validator can never describe different shapes.
    expect(document.components.schemas).toHaveProperty("ContactChannel");
    expect(document.components.schemas).toHaveProperty("Problem");
    // One component per record kind rather than one for the union: the kinds do
    // not share a shape, and a template binds to the kind it is given.
    expect(document.components.schemas).toHaveProperty("ExperienceRecord");
    expect(document.components.schemas).toHaveProperty("CustomEntryRecord");
  });
});
