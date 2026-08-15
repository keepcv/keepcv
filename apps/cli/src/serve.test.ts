import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SESSION_TOKEN_HEADER } from "@keepcv/api";
import { profileSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { startServer } from "./serve.js";

// A PGlite store on disk is a WebAssembly boot plus a full migration run, which
// is comfortably slower than the default per-test budget.
const BOOTS_A_REAL_STORE = 60_000;

describe("keepcv serve", () => {
  it(
    "boots a store on disk and serves it behind the launch token",
    async () => {
      const dataDir = await mkdtemp(join(tmpdir(), "keepcv-serve-"));
      const running = await startServer({ port: 0, dataDir });
      const url = (path: string) => `http://127.0.0.1:${running.port}${path}`;

      try {
        // The contract is readable by tooling that has not been handed a token.
        expect((await fetch(url("/v1/openapi.json"))).status).toBe(200);

        // The store is not, even on loopback.
        expect((await fetch(url("/v1/profile"))).status).toBe(401);

        const response = await fetch(url("/v1/profile"), {
          headers: { [SESSION_TOKEN_HEADER]: running.token },
        });
        expect(profileSchema.parse(await response.json()).fullName).toBeNull();

        // The app and the API share an origin, so the browser never needs to be
        // told where the store is. A client route resolves to the entry document
        // while /v1 keeps answering the API.
        const app = await fetch(url("/records"));
        expect(app.status).toBe(200);
        expect(app.headers.get("content-type")).toContain("text/html");
        expect(await app.text()).toContain('<div id="root">');

        // The token is in the fragment the launcher prints, which the browser
        // keeps to itself: the document it serves carries no token at all.
        expect((await (await fetch(url("/"))).text()).includes(running.token)).toBe(false);
      } finally {
        await running.stop();
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_A_REAL_STORE,
  );

  // Local mode holds exactly one owner, so relaunching has to find the store it
  // left rather than mint a second one nothing can reach.
  it(
    "reopens the same store on the next launch",
    async () => {
      const dataDir = await mkdtemp(join(tmpdir(), "keepcv-relaunch-"));

      const first = await startServer({ port: 0, dataDir });
      const before = await fetch(`http://127.0.0.1:${first.port}/v1/profile`, {
        headers: { [SESSION_TOKEN_HEADER]: first.token },
      });
      const created = profileSchema.parse(await before.json());
      await first.stop();

      const second = await startServer({ port: 0, dataDir });
      try {
        const after = await fetch(`http://127.0.0.1:${second.port}/v1/profile`, {
          headers: { [SESSION_TOKEN_HEADER]: second.token },
        });
        expect(profileSchema.parse(await after.json()).id).toBe(created.id);

        // A new launch means a new token, and the old one stops working.
        const stale = await fetch(`http://127.0.0.1:${second.port}/v1/profile`, {
          headers: { [SESSION_TOKEN_HEADER]: first.token },
        });
        expect(stale.status).toBe(401);
      } finally {
        await second.stop();
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_A_REAL_STORE,
  );
});
