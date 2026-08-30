import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SESSION_COOKIE, SESSION_TOKEN_HEADER } from "@keepcv/api";
import { profileSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { readAuth, writePassword } from "./auth.js";
import { startServer } from "./serve.js";

// A PGlite store on disk is a WebAssembly boot plus a full migration run, which
// is comfortably slower than the default per-test budget.
const BOOTS_A_REAL_STORE = 60_000;

function tokenOf(running: { token: string | undefined }): string {
  if (running.token === undefined) throw new Error("token mode mints a token");
  return running.token;
}

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
          headers: { [SESSION_TOKEN_HEADER]: tokenOf(running) },
        });
        expect(profileSchema.parse(await response.json()).fullName).toBeNull();

        // One origin: a client route gets the entry document, /v1 gets the API.
        const app = await fetch(url("/records"));
        expect(app.status).toBe(200);
        expect(app.headers.get("content-type")).toContain("text/html");
        expect(await app.text()).toContain('<div id="root">');

        // The token is in the fragment the launcher prints, which the browser
        // keeps to itself: the document it serves carries no token at all.
        expect((await (await fetch(url("/"))).text()).includes(tokenOf(running))).toBe(false);
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
        headers: { [SESSION_TOKEN_HEADER]: tokenOf(first) },
      });
      const created = profileSchema.parse(await before.json());
      await first.stop();

      const second = await startServer({ port: 0, dataDir });
      try {
        const after = await fetch(`http://127.0.0.1:${second.port}/v1/profile`, {
          headers: { [SESSION_TOKEN_HEADER]: tokenOf(second) },
        });
        expect(profileSchema.parse(await after.json()).id).toBe(created.id);

        // A new launch means a new token, and the old one stops working.
        const stale = await fetch(`http://127.0.0.1:${second.port}/v1/profile`, {
          headers: { [SESSION_TOKEN_HEADER]: tokenOf(first) },
        });
        expect(stale.status).toBe(401);
      } finally {
        await second.stop();
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_A_REAL_STORE,
  );

  // A token minted per run and printed to a terminal is not a credential for an
  // instance a network can reach: it cannot survive a restart and cannot be
  // typed on the phone the store is being read from.
  it("refuses to bind off loopback with nothing but a launch token", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "keepcv-exposed-"));
    try {
      await expect(startServer({ port: 0, dataDir, host: "0.0.0.0" })).rejects.toThrow(
        /--auth password or --auth proxy/,
      );
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});

describe("keepcv serve --auth password", () => {
  it(
    "hands out a session for the password and nothing else",
    async () => {
      const dataDir = await mkdtemp(join(tmpdir(), "keepcv-password-"));
      await writePassword(dataDir, "a long enough password");
      const stored = await readAuth(dataDir);
      if (stored === undefined) throw new Error("the password was just written");

      const running = await startServer({
        port: 0,
        dataDir,
        auth: { mode: "password", stored },
      });
      const url = (path: string) => `http://127.0.0.1:${running.port}${path}`;
      const signIn = async (password: string): Promise<Response> =>
        await fetch(url("/auth/sign-in"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password }),
        });

      try {
        // The app has to know what to render before it has anything to send.
        const mode = await fetch(url("/auth/mode"));
        expect(await mode.json()).toEqual({ mode: "password", signedIn: false });

        expect((await fetch(url("/v1/profile"))).status).toBe(401);
        expect((await signIn("not it")).status).toBe(401);

        const granted = await signIn("a long enough password");
        expect(granted.status).toBe(204);

        const cookie = granted.headers.get("set-cookie") ?? "";
        expect(cookie).toContain("HttpOnly");
        expect(cookie).toContain("SameSite=Strict");

        const session = cookie.split(";")[0] ?? "";
        const profile = await fetch(url("/v1/profile"), { headers: { cookie: session } });
        expect(profileSchema.parse(await profile.json()).fullName).toBeNull();

        // The cookie is HttpOnly, so only the launcher can say it is still
        // good.
        const back = await fetch(url("/auth/mode"), { headers: { cookie: session } });
        expect(await back.json()).toEqual({ mode: "password", signedIn: true });

        // Signing out is the launcher clearing the cookie it set.
        const goodbye = await fetch(url("/auth/sign-out"), { method: "POST" });
        expect(goodbye.status).toBe(204);
        expect(goodbye.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=;`);
      } finally {
        await running.stop();
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_A_REAL_STORE,
  );

  // scrypt is a tenth of a second, which on its own leaves room for tens of
  // thousands of guesses an hour.
  it(
    "stops answering after a run of wrong ones",
    async () => {
      const dataDir = await mkdtemp(join(tmpdir(), "keepcv-throttle-"));
      await writePassword(dataDir, "a long enough password");
      const stored = await readAuth(dataDir);
      if (stored === undefined) throw new Error("the password was just written");

      const running = await startServer({ port: 0, dataDir, auth: { mode: "password", stored } });
      const attempt = async (password: string): Promise<number> =>
        (
          await fetch(`http://127.0.0.1:${running.port}/auth/sign-in`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password }),
          })
        ).status;

      try {
        for (let guess = 0; guess < 5; guess += 1) expect(await attempt("not it")).toBe(401);
        expect(await attempt("not it")).toBe(429);
        // The right password is refused too: the throttle is on the route.
        expect(await attempt("a long enough password")).toBe(429);
      } finally {
        await running.stop();
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_A_REAL_STORE,
  );
});

describe("keepcv serve --auth proxy", () => {
  it(
    "reads the user the upstream named and refuses a request without one",
    async () => {
      const dataDir = await mkdtemp(join(tmpdir(), "keepcv-proxy-"));
      const running = await startServer({
        port: 0,
        dataDir,
        auth: { mode: "proxy", header: "X-Forwarded-User", from: "127.0.0.1" },
      });
      const url = (path: string) => `http://127.0.0.1:${running.port}${path}`;

      try {
        expect(await (await fetch(url("/auth/mode"))).json()).toEqual({
          mode: "proxy",
          signedIn: false,
        });
        expect((await fetch(url("/v1/profile"))).status).toBe(401);

        const profile = await fetch(url("/v1/profile"), {
          headers: { "x-forwarded-user": "me@example.com" },
        });
        expect(profileSchema.parse(await profile.json()).fullName).toBeNull();

        // There is no password to sign in with, and the app must not offer one.
        expect((await fetch(url("/auth/sign-in"), { method: "POST" })).status).toBe(404);
      } finally {
        await running.stop();
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_A_REAL_STORE,
  );
});
