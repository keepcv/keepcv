import { newUuid } from "@keepcv/core";
import { openLocalStore, runAsOwner, type Store } from "@keepcv/db";
import { type Problem, problemSchema } from "@keepcv/schema";
import { afterAll, beforeAll, beforeEach, expect } from "vitest";
import { type Api, createApi, SESSION_TOKEN_HEADER, sessionTokenAuth } from "./index.js";

export const SESSION_TOKEN = "a-token-minted-for-this-launch";

// A WebAssembly start plus every migration, and CI runs this package's files
// alongside the repository suite's, so a two-core runner has ten PGlite
// instances booting at once. The default hook budget is not enough for that.
const BOOTS_A_STORE = 60_000;

export type Send = (method: string, path: string, body?: unknown) => Promise<Response>;

export interface ApiHarness {
  send: Send;
  raw: (path: string, init?: RequestInit) => Promise<Response>;
  otherOwner: () => Promise<Send>;
}

// Authenticated by default. The guard has tests of its own, and repeating the
// header in every call would bury them.
function sendVia(app: () => Api): Send {
  return async (method, path, body) =>
    await app().request(path, {
      method,
      headers: {
        [SESSION_TOKEN_HEADER]: SESSION_TOKEN,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
}

// One store per file and a fresh owner per test, for the reason the repository
// suite does it: owner scoping is what isolates the tests, so the isolation
// under test is the isolation they rely on.
export function withApi(): ApiHarness {
  let store: Store;
  let app: Api;

  async function mintApi(): Promise<Api> {
    const ownerId = newUuid();
    await store.createOwner(ownerId);
    return createApi({
      unitOfWork: store.unitOfWork,
      runAsOwner,
      authenticate: sessionTokenAuth(SESSION_TOKEN, ownerId),
    });
  }

  beforeAll(async () => {
    store = openLocalStore();
    await store.migrate();
  }, BOOTS_A_STORE);

  afterAll(async () => {
    await store.close();
  });

  beforeEach(async () => {
    app = await mintApi();
  });

  return {
    send: sendVia(() => app),
    raw: async (path, init) => await app.request(path, init),
    otherOwner: async () => {
      const other = await mintApi();
      return sendVia(() => other);
    },
  };
}

// Parsed rather than cast: a response that drifts from the published contract
// should fail here, which is the whole reason both sides share one schema.
export async function problemOf(response: Response): Promise<Problem> {
  expect(response.headers.get("content-type")).toContain("application/problem+json");
  return problemSchema.parse(await response.json());
}
