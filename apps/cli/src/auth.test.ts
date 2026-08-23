import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SESSION_COOKIE } from "@keepcv/api";
import type { Uuid } from "@keepcv/schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  authPath,
  cookieFrom,
  hashPassword,
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
  it("verifies the password it hashed and nothing else", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(verifyPassword("correct horse battery stapl", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
  });

  // Salted, so the file never reveals that two instances share a password.
  it("hashes the same password to different strings", () => {
    expect(hashPassword("hunter2")).not.toBe(hashPassword("hunter2"));
  });

  // The stored string carries its own parameters, so raising the cost later
  // does not lock out everyone who set a password before.
  it("verifies against the cost recorded in the stored string", () => {
    const stored = hashPassword("hunter2");
    const [scheme, n, r, p] = stored.split("$");
    expect(scheme).toBe("scrypt");
    expect([n, r, p]).toEqual(["16384", "8", "1"]);
  });

  // A password typed on a Mac arrives decomposed and the same one typed on
  // Windows does not; without normalising, one machine cannot sign in.
  it("treats the two spellings of an accented password as one", () => {
    const composed = "caf\u00e9";
    const decomposed = "cafe\u0301";
    expect(composed).not.toBe(decomposed);
    expect(verifyPassword(decomposed, hashPassword(composed))).toBe(true);
  });

  it("refuses a stored string it did not write", () => {
    expect(verifyPassword("hunter2", "")).toBe(false);
    expect(verifyPassword("hunter2", "hunter2")).toBe(false);
    expect(verifyPassword("hunter2", "argon2$16384$8$1$c2FsdA$aGFzaA")).toBe(false);
    expect(verifyPassword("hunter2", "scrypt$16384$8$1$c2FsdA")).toBe(false);
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

  it("reads back a password it can verify", async () => {
    await writePassword(dataDir, "hunter2");
    const held = await readAuth(dataDir);
    expect(held).toBeDefined();
    expect(verifyPassword("hunter2", held?.hash ?? "")).toBe(true);
  });

  // Setting a password is the only revocation there is: every session was
  // signed with the secret this replaces.
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

  // The owner and the expiry are both in the signed body, so neither can be
  // edited by whoever holds the cookie.
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

  // `keepcv.session.other` shares a prefix, and a prefix match would hand back
  // the wrong value.
  it("matches the whole name", () => {
    expect(cookieFrom("keepcv.session.other=abc", SESSION_COOKIE)).toBeUndefined();
    expect(cookieFrom("other=abc", SESSION_COOKIE)).toBeUndefined();
    expect(cookieFrom(null, SESSION_COOKIE)).toBeUndefined();
  });
});

describe("passwordAuth", () => {
  it("answers the owner for a session it signed", async () => {
    const authenticate = passwordAuth(SECRET, OWNER);
    expect(await authenticate(withCookie(mintSession(SECRET, OWNER)))).toBe(OWNER);
  });

  it("answers nothing without a cookie, or with one it did not sign", async () => {
    const authenticate = passwordAuth(SECRET, OWNER);
    expect(await authenticate(new Request("http://127.0.0.1/v1/profile"))).toBeUndefined();
    expect(await authenticate(withCookie("forged"))).toBeUndefined();
  });

  // A local store holds one owner. A validly signed session for anybody else is
  // a session this instance cannot serve, and must not fall back to its own.
  it("answers nothing for a session belonging to another owner", async () => {
    const authenticate = passwordAuth(SECRET, OWNER);
    expect(await authenticate(withCookie(mintSession(SECRET, OTHER)))).toBeUndefined();
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

  // A launcher that read the header from anywhere would let anyone who can
  // reach the port set it themselves.
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
