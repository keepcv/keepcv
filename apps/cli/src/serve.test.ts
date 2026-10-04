import { mkdtemp, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SESSION_COOKIE, SESSION_TOKEN_HEADER } from "@keepcv/api";
import { profileSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { readAuth, writePassword } from "./auth.js";
import { startServer } from "./serve.js";

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
        expect((await fetch(url("/v1/openapi.json"))).status).toBe(200);

        expect((await fetch(url("/v1/profile"))).status).toBe(401);

        const response = await fetch(url("/v1/profile"), {
          headers: { [SESSION_TOKEN_HEADER]: tokenOf(running) },
        });
        expect(profileSchema.parse(await response.json()).fullName).toBeNull();
        for (const headers of [{ origin: "https://attacker.example" }, { origin: "null" }]) {
          const refused = await fetch(url("/v1/profile"), {
            headers: { ...headers, [SESSION_TOKEN_HEADER]: tokenOf(running) },
          });
          expect(refused.status).toBe(403);
          expect(refused.headers.get("access-control-allow-origin")).toBeNull();
        }
        const rebound = await new Promise<number>((resolve, reject) => {
          const call = httpRequest(
            url("/v1/profile"),
            {
              headers: { host: "attacker.example", [SESSION_TOKEN_HEADER]: tokenOf(running) },
            },
            (answer) => {
              answer.resume();
              resolve(answer.statusCode ?? 0);
            },
          );
          call.on("error", reject);
          call.end();
        });
        expect(rebound).toBe(403);
        const same = await fetch(url("/v1/profile"), {
          headers: { origin: url(""), [SESSION_TOKEN_HEADER]: tokenOf(running) },
        });
        expect(same.status).toBe(200);

        const app = await fetch(url("/records"));
        expect(app.status).toBe(200);
        expect(app.headers.get("content-type")).toContain("text/html");
        expect(app.headers.get("content-security-policy")).toContain("script-src 'self'");
        expect(app.headers.get("content-security-policy")).toContain("connect-src 'self'");
        expect(app.headers.get("x-content-type-options")).toBe("nosniff");
        expect(await app.text()).toContain('<div id="root">');

        expect((await (await fetch(url("/"))).text()).includes(tokenOf(running))).toBe(false);
      } finally {
        await running.stop();
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_A_REAL_STORE,
  );

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
    "revokes old credentials while the server remains running",
    async () => {
      const dataDir = await mkdtemp(join(tmpdir(), "keepcv-rotation-"));
      await writePassword(dataDir, "the old password");
      const running = await startServer({
        port: 0,
        dataDir,
        auth: { mode: "password", read: () => readAuth(dataDir) },
      });
      const url = (path: string) => `http://127.0.0.1:${running.port}${path}`;
      const signIn = (password: string) =>
        fetch(url("/auth/sign-in"), { method: "POST", body: JSON.stringify({ password }) });
      try {
        const first = await signIn("the old password");
        expect(first.status).toBe(204);
        const cookie = first.headers.get("set-cookie")?.split(";")[0] ?? "";
        await writePassword(dataDir, "the new password");
        expect((await fetch(url("/v1/store"), { headers: { cookie } })).status).toBe(401);
        expect((await signIn("the old password")).status).toBe(401);
        const second = await signIn("the new password");
        expect(second.status).toBe(204);
        const current = second.headers.get("set-cookie")?.split(";")[0] ?? "";
        expect((await fetch(url("/v1/store"), { headers: { cookie: current } })).status).toBe(200);
        await rm(join(dataDir, "auth.json"));
        expect((await fetch(url("/v1/store"), { headers: { cookie: current } })).status).toBe(401);
        expect((await signIn("the new password")).status).toBe(401);
      } finally {
        await running.stop();
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_A_REAL_STORE,
  );
  it(
    "uses an HTTPS public origin for real sign-in requests and secure cookies",
    async () => {
      const dataDir = await mkdtemp(join(tmpdir(), "keepcv-origin-"));
      await writePassword(dataDir, "a long enough password");
      const stored = await readAuth(dataDir);
      if (stored === undefined) throw new Error("the password was just written");
      const running = await startServer({
        port: 0,
        dataDir,
        origin: "https://cv.example.test",
        auth: { mode: "password", read: () => readAuth(dataDir) },
      });
      try {
        const granted = await new Promise<{ status: number; cookie: string }>((resolve, reject) => {
          const call = httpRequest(
            `http://127.0.0.1:${running.port}/auth/sign-in`,
            {
              method: "POST",
              headers: {
                host: "cv.example.test",
                origin: "https://cv.example.test",
                "content-type": "application/json",
              },
            },
            (response) => {
              response.resume();
              resolve({
                status: response.statusCode ?? 0,
                cookie: response.headers["set-cookie"]?.join(";") ?? "",
              });
            },
          );
          call.on("error", reject);
          call.end(JSON.stringify({ password: "a long enough password" }));
        });
        expect(granted.status).toBe(204);
        expect(granted.cookie).toContain("; Secure");
        expect(granted.cookie).toContain("SameSite=Strict");
        const spoofed = await fetch(`http://127.0.0.1:${running.port}/auth/mode`, {
          headers: { "x-forwarded-host": "cv.example.test", "x-forwarded-proto": "https" },
        });
        expect(spoofed.status).toBe(403);
      } finally {
        await running.stop();
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_A_REAL_STORE,
  );
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
        auth: { mode: "password", read: () => readAuth(dataDir) },
      });
      const url = (path: string) => `http://127.0.0.1:${running.port}${path}`;
      const signIn = async (password: string): Promise<Response> =>
        await fetch(url("/auth/sign-in"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password }),
        });

      try {
        const mode = await fetch(url("/auth/mode"));
        expect(await mode.json()).toEqual({ mode: "password", signedIn: false });

        expect((await fetch(url("/v1/profile"))).status).toBe(401);
        const forged = await fetch(url("/auth/sign-in"), {
          method: "POST",
          headers: { origin: "https://attacker.example", "content-type": "application/json" },
          body: JSON.stringify({ password: "a long enough password" }),
        });
        expect(forged.status).toBe(403);
        expect((await signIn("not it")).status).toBe(401);

        const granted = await signIn("a long enough password");
        expect(granted.status).toBe(204);

        const cookie = granted.headers.get("set-cookie") ?? "";
        expect(cookie).toContain("HttpOnly");
        expect(cookie).toContain("SameSite=Strict");

        const session = cookie.split(";")[0] ?? "";
        const profile = await fetch(url("/v1/profile"), { headers: { cookie: session } });
        expect(profileSchema.parse(await profile.json()).fullName).toBeNull();

        const back = await fetch(url("/auth/mode"), { headers: { cookie: session } });
        expect(await back.json()).toEqual({ mode: "password", signedIn: true });

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

  it(
    "stops answering after a run of wrong ones",
    async () => {
      const dataDir = await mkdtemp(join(tmpdir(), "keepcv-throttle-"));
      await writePassword(dataDir, "a long enough password");
      const stored = await readAuth(dataDir);
      if (stored === undefined) throw new Error("the password was just written");

      const running = await startServer({
        port: 0,
        dataDir,
        auth: { mode: "password", read: () => readAuth(dataDir) },
      });
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
  it("requires a declared public origin for a network bind", async () => {
    await expect(
      startServer({
        port: 4319,
        dataDir: ".keepcv-scratch",
        host: "0.0.0.0",
        auth: { mode: "proxy", header: "X-Forwarded-User", from: "127.0.0.1" },
      }),
    ).rejects.toThrow(/--origin/);
  });
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

        expect((await fetch(url("/auth/sign-in"), { method: "POST" })).status).toBe(404);
      } finally {
        await running.stop();
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_A_REAL_STORE,
  );
});
