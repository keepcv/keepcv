import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type Authenticate,
  type AuthMode,
  type AuthState,
  SESSION_COOKIE,
  sessionTokenAuth,
} from "@keepcv/api";
import type { Uuid } from "@keepcv/schema";

const AUTH_FILE = "auth.json";

// api-contract.md #6
const COST = { N: 2 ** 14, r: 8, p: 1, keylen: 32, maxmem: 64 * 1024 * 1024 };

const SESSION_LASTS_MS = 30 * 24 * 60 * 60 * 1000;
const ATTEMPTS_ALLOWED = 5;
const ATTEMPTS_WINDOW_MS = 60 * 1000;

export interface StoredAuth {
  hash: string;
  // Rotated whenever the password is set, so setting a new one ends every
  // session signed with the old key.
  secret: string;
}

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

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, n, r, p, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || n === undefined || r === undefined || p === undefined) return false;
  if (salt === undefined || expected === undefined) return false;

  const want = Buffer.from(expected, "base64url");
  const got = scryptSync(password.normalize("NFKC"), Buffer.from(salt, "base64url"), want.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: COST.maxmem,
  });
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function readAuth(dataDir: string): Promise<StoredAuth | undefined> {
  const body = await readFile(authPath(dataDir), "utf8").catch(() => undefined);
  if (body === undefined) return undefined;
  try {
    const held = JSON.parse(body) as Partial<StoredAuth>;
    if (typeof held.hash !== "string" || typeof held.secret !== "string") return undefined;
    return { hash: held.hash, secret: held.secret };
  } catch {
    return undefined;
  }
}

export async function writePassword(dataDir: string, password: string): Promise<void> {
  const stored: StoredAuth = {
    hash: hashPassword(password),
    secret: randomBytes(32).toString("base64url"),
  };
  // A password can be set before the store has ever been opened.
  await mkdir(dataDir, { recursive: true });
  await writeFile(authPath(dataDir), `${JSON.stringify(stored, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

// `<ownerId>.<expiry>.<mac>`: stateless, so a restart does not end a session and
// there is no session table to keep. Revocation is rotating the secret, which
// is what setting a password does.
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

export function passwordAuth(secret: string, ownerId: Uuid): Authenticate {
  return (request) => {
    const cookie = cookieFrom(request.headers.get("cookie"), SESSION_COOKIE);
    if (cookie === undefined) return Promise.resolve(undefined);
    const signedInAs = readSession(secret, cookie);
    // One owner per instance here, so a session for anyone else is a session
    // this store cannot serve.
    return Promise.resolve(signedInAs === ownerId ? ownerId : undefined);
  };
}

// The upstream has already authenticated; the launcher has already refused any
// connection that did not come from it. This only reads who it said.
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
  // Resolved before the store opens, so a launcher told to want a password it
  // does not have says so instead of booting into a store nobody can reach.
  | { mode: "password"; stored: StoredAuth }
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

function sessionCookie(value: string, seconds: number): string {
  // No `Secure`: the launcher serves plain HTTP and a proxy in front of it is
  // the only thing that could be terminating TLS.
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${String(seconds)}`;
}

function passwordFrom(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const given = (body as { password?: unknown }).password;
  return typeof given === "string" ? given : undefined;
}

// scrypt costs a tenth of a second, which alone allows tens of thousands of
// guesses an hour against a password a person chose.
function signIn(stored: StoredAuth, ownerId: Uuid): (request: Request) => Promise<Response> {
  const refused: number[] = [];
  return async (request) => {
    const now = Date.now();
    while ((refused[0] ?? Number.POSITIVE_INFINITY) <= now - ATTEMPTS_WINDOW_MS) refused.shift();
    if (refused.length >= ATTEMPTS_ALLOWED) {
      return reply({ error: "Too many attempts. Wait a minute and try again." }, 429);
    }

    const password = passwordFrom(await request.json().catch(() => undefined));
    if (password === undefined || !verifyPassword(password, stored.hash)) {
      refused.push(now);
      return reply({ error: "That is not the password." }, 401);
    }

    refused.length = 0;
    const cookie = sessionCookie(mintSession(stored.secret, ownerId), SESSION_LASTS_MS / 1000);
    return reply(undefined, 204, cookie);
  };
}

export function launcherAuth(setting: AuthSetting, ownerId: Uuid): LauncherAuth {
  const token = setting.mode === "token" ? randomBytes(32).toString("base64url") : undefined;
  const authenticate =
    setting.mode === "token"
      ? sessionTokenAuth(token ?? "", ownerId)
      : setting.mode === "password"
        ? passwordAuth(setting.stored.secret, ownerId)
        : proxyAuth(setting.header, ownerId, setting.user);

  const attempt = setting.mode === "password" ? signIn(setting.stored, ownerId) : undefined;

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
        return reply(undefined, 204, sessionCookie("", 0));
      }
      return undefined;
    },
  };
}
