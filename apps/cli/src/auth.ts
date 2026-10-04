import { createHmac, randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type Authenticate,
  type AuthMode,
  type AuthState,
  SESSION_COOKIE,
  sessionTokenAuth,
} from "@keepcv/api";
import type { Uuid } from "@keepcv/schema";
import { privateDirectory, writePrivateFile } from "./private-file.js";

const AUTH_FILE = "auth.json";

const COST = { N: 2 ** 14, r: 8, p: 1, keylen: 32, maxmem: 64 * 1024 * 1024 };

const SESSION_LASTS_MS = 30 * 24 * 60 * 60 * 1000;
const ATTEMPTS_ALLOWED = 5;
const ATTEMPTS_WINDOW_MS = 60 * 1000;
const SIGN_IN_BYTES = 8192;
const SIGN_IN_TIMEOUT_MS = 10_000;
const PASSWORD_CHARACTERS = 1024;

export interface StoredAuth {
  hash: string;
  secret: string;
}

type ReadCredentials = () => Promise<StoredAuth | undefined>;

export function authPath(dataDir: string): string {
  return join(dataDir, AUTH_FILE);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password.normalize("NFKC"), salt, COST.keylen, COST);
  return [
    "scrypt",
    String(COST.N),
    String(COST.r),
    String(COST.p),
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || n === undefined || r === undefined || p === undefined) return false;
  if (salt === undefined || expected === undefined) return false;

  const want = Buffer.from(expected, "base64url");
  if (want.length !== COST.keylen) return false;
  const got = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      Buffer.from(salt, "base64url"),
      want.length,
      {
        N: Number(n),
        r: Number(r),
        p: Number(p),
        maxmem: COST.maxmem,
      },
      (error, derived) => (error === null ? resolve(derived) : reject(error)),
    );
  }).catch(() => undefined);
  if (got === undefined) return false;
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function readAuth(dataDir: string): Promise<StoredAuth | undefined> {
  const body = await readFile(authPath(dataDir), "utf8").catch(() => undefined);
  if (body === undefined) return undefined;
  try {
    const held = JSON.parse(body) as Partial<StoredAuth>;
    if (typeof held.hash !== "string" || typeof held.secret !== "string") return undefined;
    if (
      !/^scrypt\$[1-9]\d*\$[1-9]\d*\$[1-9]\d*\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/.test(
        held.hash,
      )
    )
      return undefined;
    if (!/^[A-Za-z0-9_-]{43}$/.test(held.secret)) return undefined;
    return { hash: held.hash, secret: held.secret };
  } catch {
    return undefined;
  }
}

export async function writePassword(dataDir: string, password: string): Promise<void> {
  if (password.length > PASSWORD_CHARACTERS)
    throw new Error("Use a password of at most 1024 characters.");
  const stored: StoredAuth = {
    hash: hashPassword(password),
    secret: randomBytes(32).toString("base64url"),
  };
  await privateDirectory(dataDir);
  await writePrivateFile(authPath(dataDir), `${JSON.stringify(stored, null, 2)}\n`);
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function mintSession(secret: string, ownerId: Uuid, now = Date.now()): string {
  const body = `${ownerId}.${String(now + SESSION_LASTS_MS)}`;
  return `${body}.${sign(secret, body)}`;
}

export function readSession(secret: string, cookie: string, now = Date.now()): Uuid | undefined {
  const at = cookie.lastIndexOf(".");
  if (at <= 0) return undefined;

  const body = cookie.slice(0, at);
  const presented = Buffer.from(cookie.slice(at + 1), "base64url");
  const expected = Buffer.from(sign(secret, body), "base64url");
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
    return undefined;
  }

  const [ownerId, expiry] = body.split(".");
  if (ownerId === undefined || expiry === undefined || Number(expiry) <= now) return undefined;
  return ownerId as Uuid;
}

export function cookieFrom(header: string | null, name: string): string | undefined {
  if (header === null) return undefined;
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return undefined;
}

export function passwordAuth(read: ReadCredentials, ownerId: Uuid): Authenticate {
  return async (request) => {
    const cookie = cookieFrom(request.headers.get("cookie"), SESSION_COOKIE);
    if (cookie === undefined) return undefined;
    const stored = await read();
    if (stored === undefined) return undefined;
    const signedInAs = readSession(stored.secret, cookie);
    return signedInAs === ownerId ? ownerId : undefined;
  };
}

export function proxyAuth(header: string, ownerId: Uuid, expected?: string): Authenticate {
  const name = header.toLowerCase();
  return (request) => {
    const presented = request.headers.get(name);
    if (presented === null || presented === "") return Promise.resolve(undefined);
    if (expected !== undefined && presented !== expected) return Promise.resolve(undefined);
    return Promise.resolve(ownerId);
  };
}

export type AuthSetting =
  | { mode: "token" }
  | { mode: "password"; read: ReadCredentials }
  | { mode: "proxy"; header: string; from: string; user?: string };

export interface LauncherAuth {
  mode: AuthMode;
  token: string | undefined;
  authenticate: Authenticate;
  routes: (request: Request) => Promise<Response | undefined>;
  trusts: (remoteAddress: string | undefined) => boolean;
}

// `::ffff:127.0.0.1` is what a dual-stack listener reports for a v4 connection.
export function sameAddress(a: string | undefined, b: string): boolean {
  const bare = (value: string): string => value.replace(/^::ffff:/, "");
  if (a === undefined) return false;
  return bare(a) === bare(b) || (bare(a) === "::1" && bare(b) === "127.0.0.1");
}

function reply(body: unknown, status: number, cookie?: string): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "cache-control": "no-store",
      ...(status === 204 ? {} : { "content-type": "application/json" }),
      ...(cookie === undefined ? {} : { "set-cookie": cookie }),
    },
  });
}

function sessionCookie(value: string, seconds: number, secure = false): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${String(seconds)}${secure ? "; Secure" : ""}`;
}

function passwordFrom(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const given = (body as { password?: unknown }).password;
  return typeof given === "string" && given.length <= PASSWORD_CHARACTERS ? given : undefined;
}

async function readPassword(request: Request): Promise<string | Response> {
  if (Number(request.headers.get("content-length")) > SIGN_IN_BYTES) {
    return reply({ error: "Sign-in body is too large." }, 413);
  }
  const reader = request.body?.getReader();
  if (reader === undefined) return reply({ error: "A password is required." }, 400);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<Response>((resolve) => {
    timer = setTimeout(() => {
      void reader.cancel().catch(() => undefined);
      resolve(reply({ error: "Sign-in body timed out." }, 408));
    }, SIGN_IN_TIMEOUT_MS);
  });
  const read = async (): Promise<string | Response> => {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const value: unknown = chunk.value;
      if (!(value instanceof Uint8Array))
        return reply({ error: "A JSON password is required." }, 400);
      bytes += value.byteLength;
      if (bytes > SIGN_IN_BYTES) {
        void reader.cancel().catch(() => undefined);
        return reply({ error: "Sign-in body is too large." }, 413);
      }
      chunks.push(value);
    }
    const password = passwordFrom(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    return password ?? reply({ error: "A password of at most 1024 characters is required." }, 400);
  };
  try {
    return await Promise.race([read(), expired]);
  } catch {
    return reply({ error: "A JSON password is required." }, 400);
  } finally {
    clearTimeout(timer);
  }
}

function signIn(read: ReadCredentials, ownerId: Uuid): (request: Request) => Promise<Response> {
  let attempts: { at: number; pending: boolean }[] = [];
  return async (request) => {
    const now = Date.now();
    attempts = attempts.filter(
      (attempt) => attempt.pending || attempt.at > now - ATTEMPTS_WINDOW_MS,
    );
    if (attempts.length >= ATTEMPTS_ALLOWED) {
      return reply({ error: "Too many attempts. Wait a minute and try again." }, 429);
    }
    const attempt = { at: now, pending: true };
    attempts.push(attempt);
    try {
      const password = await readPassword(request);
      if (password instanceof Response) return password;
      const stored = await read();
      if (stored === undefined || !(await verifyPassword(password, stored.hash))) {
        return reply({ error: "That is not the password." }, 401);
      }
      if ((await read())?.secret !== stored.secret) {
        return reply({ error: "The password changed. Sign in again." }, 401);
      }
      attempts = attempts.filter((held) => held.pending && held !== attempt);
      const cookie = sessionCookie(
        mintSession(stored.secret, ownerId),
        SESSION_LASTS_MS / 1000,
        new URL(request.url).protocol === "https:",
      );
      return reply(undefined, 204, cookie);
    } finally {
      attempt.pending = false;
    }
  };
}

export function launcherAuth(setting: AuthSetting, ownerId: Uuid): LauncherAuth {
  const token = setting.mode === "token" ? randomBytes(32).toString("base64url") : undefined;
  const authenticate =
    setting.mode === "token"
      ? sessionTokenAuth(token ?? "", ownerId)
      : setting.mode === "password"
        ? passwordAuth(setting.read, ownerId)
        : proxyAuth(setting.header, ownerId, setting.user);

  const attempt = setting.mode === "password" ? signIn(setting.read, ownerId) : undefined;

  return {
    mode: setting.mode,
    token,
    authenticate,
    trusts: (remoteAddress) => setting.mode !== "proxy" || sameAddress(remoteAddress, setting.from),
    routes: async (request) => {
      const { pathname } = new URL(request.url);
      if (pathname === "/auth/mode" && request.method === "GET") {
        // The cookie is `HttpOnly`, so whether it is still good is a question
        // only the launcher can answer.
        const state: AuthState = {
          mode: setting.mode,
          signedIn: (await authenticate(request)) !== undefined,
        };
        return reply(state, 200);
      }
      if (pathname === "/auth/sign-in" && request.method === "POST") {
        return attempt === undefined
          ? reply({ error: "No password is set." }, 404)
          : await attempt(request);
      }
      if (pathname === "/auth/sign-out" && request.method === "POST") {
        return reply(
          undefined,
          204,
          sessionCookie("", 0, new URL(request.url).protocol === "https:"),
        );
      }
      return undefined;
    },
  };
}
