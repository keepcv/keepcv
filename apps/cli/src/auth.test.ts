import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SESSION_COOKIE } from "@keepcv/api";
import type { Uuid } from "@keepcv/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authPath,
  cookieFrom,
  hashPassword,
  launcherAuth,
  mintSession,
  passwordAuth,
  proxyAuth,
  readAuth,
  readSession,
  sameAddress,
  verifyPassword,
  writePassword,
} from "./auth.js";

const OWNER = "01890000-0000-7000-8000-000000000001" as Uuid;
const OTHER = "01890000-0000-7000-8000-000000000002" as Uuid;
const SECRET = "a-launcher-secret";

function withCookie(value: string): Request {
  return new Request("http://127.0.0.1/v1/profile", {
    headers: { cookie: `${SESSION_COOKIE}=${value}` },
  });
}

describe("passwords", () => {
  it("verifies the password it hashed and nothing else", async () => {
    const stored = hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(await verifyPassword("correct horse battery stapl", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("hashes the same password to different strings", () => {
    expect(hashPassword("hunter2")).not.toBe(hashPassword("hunter2"));
  });

  it("verifies against the cost recorded in the stored string", () => {
    const stored = hashPassword("hunter2");
    const [scheme, n, r, p] = stored.split("$");
    expect(scheme).toBe("scrypt");
    expect([n, r, p]).toEqual(["16384", "8", "1"]);
  });

  it("treats the two spellings of an accented password as one", async () => {
    const composed = "caf\u00e9";
    const decomposed = "cafe\u0301";
    expect(composed).not.toBe(decomposed);
    expect(await verifyPassword(decomposed, hashPassword(composed))).toBe(true);
  });

  it("refuses a stored string it did not write", async () => {
    expect(await verifyPassword("hunter2", "")).toBe(false);
    expect(await verifyPassword("hunter2", "hunter2")).toBe(false);
    expect(await verifyPassword("hunter2", "argon2$16384$8$1$c2FsdA$aGFzaA")).toBe(false);
    expect(await verifyPassword("hunter2", "scrypt$16384$8$1$c2FsdA")).toBe(false);
  });
});

describe("the auth file", () => {
  let dataDir = "";

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "keepcv-auth-"));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it("has nothing to read before a password is set", async () => {
    expect(await readAuth(dataDir)).toBeUndefined();
  });

  it("refuses malformed credentials and an unusably long new password", async () => {
    await writeFile(
      authPath(dataDir),
      JSON.stringify({ hash: "scrypt$16384$8$1$salt$", secret: SECRET }),
    );
    expect(await readAuth(dataDir)).toBeUndefined();
    await expect(writePassword(dataDir, "x".repeat(1025))).rejects.toThrow("at most 1024");
  });

  it("reads back a password it can verify", async () => {
    await writePassword(dataDir, "hunter2");
    const held = await readAuth(dataDir);
    expect(held).toBeDefined();
    expect(await verifyPassword("hunter2", held?.hash ?? "")).toBe(true);
  });

  it("rotates the secret on every write", async () => {
    await writePassword(dataDir, "hunter2");
    const first = await readAuth(dataDir);
    await writePassword(dataDir, "hunter2");
    expect((await readAuth(dataDir))?.secret).not.toBe(first?.secret);
  });

  it("holds no password in plain text", async () => {
    await writePassword(dataDir, "hunter2");
    expect(await readFile(authPath(dataDir), "utf8")).not.toContain("hunter2");
  });

  it("treats an unreadable file as no password at all", async () => {
    await writeFile(authPath(dataDir), "{ not json");
    expect(await readAuth(dataDir)).toBeUndefined();

    await writeFile(authPath(dataDir), JSON.stringify({ hash: 12 }));
    expect(await readAuth(dataDir)).toBeUndefined();
  });
});

describe("sessions", () => {
  it("reads back the owner it minted for", () => {
    expect(readSession(SECRET, mintSession(SECRET, OWNER))).toBe(OWNER);
  });

  it("refuses one signed with another secret", () => {
    expect(readSession(SECRET, mintSession("rotated", OWNER))).toBeUndefined();
  });

  it("refuses an edited owner or an extended expiry", () => {
    const cookie = mintSession(SECRET, OWNER);
    const [, expiry, mac] = cookie.split(".");
    expect(readSession(SECRET, `${OTHER}.${String(expiry)}.${String(mac)}`)).toBeUndefined();
    expect(readSession(SECRET, `${OWNER}.9999999999999.${String(mac)}`)).toBeUndefined();
  });

  it("refuses one that has run out", () => {
    const minted = mintSession(SECRET, OWNER, 0);
    expect(readSession(SECRET, minted, 0)).toBe(OWNER);
    expect(readSession(SECRET, minted, 40 * 24 * 60 * 60 * 1000)).toBeUndefined();
  });

  it("refuses a cookie that is not one of these", () => {
    expect(readSession(SECRET, "")).toBeUndefined();
    expect(readSession(SECRET, "nonsense")).toBeUndefined();
    expect(readSession(SECRET, ".")).toBeUndefined();
  });
});

describe("cookieFrom", () => {
  it("picks the named cookie out of the header", () => {
    expect(cookieFrom("a=1; keepcv.session=abc; b=2", SESSION_COOKIE)).toBe("abc");
    expect(cookieFrom("keepcv.session=abc", SESSION_COOKIE)).toBe("abc");
  });

  it("matches the whole name", () => {
    expect(cookieFrom("keepcv.session.other=abc", SESSION_COOKIE)).toBeUndefined();
    expect(cookieFrom("other=abc", SESSION_COOKIE)).toBeUndefined();
    expect(cookieFrom(null, SESSION_COOKIE)).toBeUndefined();
  });
});

describe("passwordAuth", () => {
  it("fails closed when current credentials are missing", async () => {
    expect(
      await passwordAuth(
        () => Promise.resolve(undefined),
        OWNER,
      )(withCookie(mintSession(SECRET, OWNER))),
    ).toBeUndefined();
  });
  it("sets and clears secure cookies for an HTTPS public origin", async () => {
    const auth = launcherAuth(
      {
        mode: "password",
        read: () => Promise.resolve({ hash: hashPassword("hunter2"), secret: SECRET }),
      },
      OWNER,
    );
    const granted = await auth.routes(
      new Request("https://cv.example.test/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "hunter2" }),
      }),
    );
    expect(granted?.status).toBe(204);
    expect(granted?.headers.get("set-cookie")).toContain("; Secure");
    const cleared = await auth.routes(
      new Request("https://cv.example.test/auth/sign-out", { method: "POST" }),
    );
    expect(cleared?.headers.get("set-cookie")).toContain("; Secure");
    expect(cleared?.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("answers the owner for a session it signed", async () => {
    const authenticate = passwordAuth(
      () => Promise.resolve({ hash: "unused", secret: SECRET }),
      OWNER,
    );
    expect(await authenticate(withCookie(mintSession(SECRET, OWNER)))).toBe(OWNER);
  });

  it("answers nothing without a cookie, or with one it did not sign", async () => {
    const authenticate = passwordAuth(
      () => Promise.resolve({ hash: "unused", secret: SECRET }),
      OWNER,
    );
    expect(await authenticate(new Request("http://127.0.0.1/v1/profile"))).toBeUndefined();
    expect(await authenticate(withCookie("forged"))).toBeUndefined();
  });

  it("answers nothing for a session belonging to another owner", async () => {
    const authenticate = passwordAuth(
      () => Promise.resolve({ hash: "unused", secret: SECRET }),
      OWNER,
    );
    expect(await authenticate(withCookie(mintSession(SECRET, OTHER)))).toBeUndefined();
  });
});

describe("sign-in admission", () => {
  it("does not mint a session if credentials rotate during verification", async () => {
    const old = { hash: hashPassword("a long password"), secret: SECRET };
    let reads = 0;
    const held = launcherAuth(
      {
        mode: "password",
        read: () => Promise.resolve(++reads === 1 ? old : { ...old, secret: "rotated" }),
      },
      OWNER,
    );
    const response = await held.routes(
      new Request("http://127.0.0.1/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ password: "a long password" }),
      }),
    );
    expect(response?.status).toBe(401);
    expect(response?.headers.get("set-cookie")).toBeNull();
  });
  function auth() {
    const stored = { hash: hashPassword("a long password"), secret: SECRET };
    return launcherAuth({ mode: "password", read: () => Promise.resolve(stored) }, OWNER);
  }

  it("counts incomplete concurrent bodies before checking their passwords", async () => {
    const held = auth();
    const bodies: ReadableStreamDefaultController<Uint8Array>[] = [];
    const pending = Array.from({ length: 12 }, () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          bodies.push(controller);
        },
      });
      const init = { method: "POST", body, duplex: "half" as const };
      return held.routes(new Request("http://127.0.0.1/auth/sign-in", init));
    });
    for (const body of bodies) {
      body.enqueue(new TextEncoder().encode('{"password":"wrong"}'));
      body.close();
    }
    const statuses = (await Promise.all(pending)).map((response) => response?.status);
    expect(statuses.filter((status) => status === 401)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(7);
  });

  it.each([{}, { "content-length": "1" }])(
    "limits streamed bytes regardless of the length header: %s",
    async (headers) => {
      const response = await auth().routes(
        new Request("http://127.0.0.1/auth/sign-in", {
          method: "POST",
          headers,
          body: JSON.stringify({ password: "a long password", padding: "x".repeat(8192) }),
        }),
      );
      expect(response?.status).toBe(413);
    },
  );

  it("refuses a declared oversized body before waiting for bytes", async () => {
    const response = await auth().routes(
      new Request("http://127.0.0.1/auth/sign-in", {
        method: "POST",
        headers: { "content-length": "9000" },
        body: "{}",
      }),
    );
    expect(response?.status).toBe(413);
  });

  it("cancels an incomplete body after the deadline", async () => {
    vi.useFakeTimers();
    let cancelled = false;
    try {
      const body = new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
        },
      });
      const init = { method: "POST", body, duplex: "half" as const };
      const response = auth().routes(new Request("http://127.0.0.1/auth/sign-in", init));
      await vi.advanceTimersByTimeAsync(10_001);
      expect((await response)?.status).toBe(408);
      expect(cancelled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("expires completed refusals and resets them after a successful sign-in", async () => {
    vi.useFakeTimers();
    const held = auth();
    const attempt = (password: string) =>
      held.routes(
        new Request("http://127.0.0.1/auth/sign-in", {
          method: "POST",
          body: JSON.stringify({ password }),
        }),
      );
    try {
      for (let at = 0; at < 5; at += 1) expect((await attempt("wrong"))?.status).toBe(401);
      expect((await attempt("a long password"))?.status).toBe(429);
      await vi.advanceTimersByTimeAsync(60_001);
      expect((await attempt("a long password"))?.status).toBe(204);
      for (let at = 0; at < 5; at += 1) expect((await attempt("wrong"))?.status).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("proxyAuth", () => {
  function asUser(value: string | undefined): Request {
    return new Request("http://127.0.0.1/v1/profile", {
      headers: value === undefined ? {} : { "x-forwarded-user": value },
    });
  }

  it("answers the owner when the upstream named a user", async () => {
    const authenticate = proxyAuth("X-Forwarded-User", OWNER);
    expect(await authenticate(asUser("someone@example.com"))).toBe(OWNER);
  });

  it("answers nothing when the header is missing or empty", async () => {
    const authenticate = proxyAuth("X-Forwarded-User", OWNER);
    expect(await authenticate(asUser(undefined))).toBeUndefined();
    expect(await authenticate(asUser(""))).toBeUndefined();
  });

  it("trusts one address, in either of the two spellings of it", () => {
    expect(sameAddress("127.0.0.1", "127.0.0.1")).toBe(true);
    expect(sameAddress("::ffff:127.0.0.1", "127.0.0.1")).toBe(true);
    expect(sameAddress("::1", "127.0.0.1")).toBe(true);
    expect(sameAddress("10.0.0.4", "127.0.0.1")).toBe(false);
    expect(sameAddress(undefined, "127.0.0.1")).toBe(false);
    expect(sameAddress("10.0.0.4", "10.0.0.4")).toBe(true);
  });

  it("answers nothing when the named user is not the expected one", async () => {
    const authenticate = proxyAuth("X-Forwarded-User", OWNER, "me@example.com");
    expect(await authenticate(asUser("someone@example.com"))).toBeUndefined();
    expect(await authenticate(asUser("me@example.com"))).toBe(OWNER);
  });
});
